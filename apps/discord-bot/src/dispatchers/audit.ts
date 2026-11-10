import type { AuditEvent } from '@unbound-app/web/bot';
import type { APIEmbed, APIMessage } from 'discord.js';
import { asc, desc, eq, max } from 'drizzle-orm';

import {
	createMessageGateway,
	discordFailure,
	eventNonce,
	type MessageGateway,
	type OutgoingMessage,
} from '~/lib/discord-messages';
import {
	buildAuditEmbed,
	buildDeployEmbed,
	buildFallbackEmbed,
	type DeployBatch,
} from '~/dispatchers/audit-embed';
import type { Dispatcher, DispatcherContext, Stores } from '~/dispatchers/types';
import { deployBuild, type FirstPartyBuild } from '~/dispatchers/audit-kinds';
import type { AuditTelemetry } from '~/lib/audit-telemetry';
import type { Database } from '~/db/database';
import { requireId } from '~/lib/constants';
import { auditPost } from '~/db/schema';

// Posts are strictly sequential, so a post orphaned by a crash is always among the newest messages.
const RECOVERY_WINDOW = 100;
const PAGE = 100;
// A batch post's footer reads `Events #first–#last`; it was last edited for its last event.
const FOOTER_ID = /^Events? #(?:\d+–#)?(\d+) /;
const MAX_BATCH = 20;

type Batch = {
	messageId: string;
	events: DeployBatch;
};

// An empty `audit_post` means the log was never enabled here, so the newest event becomes the floor and
// enabling posts no history. An empty moderation log floors at 0, which posts its first event.
async function recordFloor({ db, web }: Stores, channelId: string) {
	const floor = await web.newestEventId();

	await db
		.insert(auditPost)
		.values({ eventId: floor, channelId, messageId: null })
		.onConflictDoNothing();

	return floor;
}

// Posts go out one at a time in id order and moderation event ids are commit-ordered, so every
// event up to the newest posted one is posted: that id is the whole cursor.
async function pendingEvents(stores: Stores, channelId: string): Promise<AuditEvent[]> {
	const [row] = await stores.db.select({ last: max(auditPost.eventId) }).from(auditPost);
	const last = row?.last ?? (await recordFloor(stores, channelId));

	return stores.web.eventsAfter(last, PAGE);
}

// Both a fresh post and an adopted one pass through here once, so each event is exported once.
async function markPosted(
	db: Database,
	telemetry: AuditTelemetry,
	event: AuditEvent,
	channelId: string,
	messageId: string,
	embed: APIEmbed,
) {
	await db
		.insert(auditPost)
		.values({ eventId: event.id, channelId, messageId })
		.onConflictDoNothing();
	telemetry.emit(event, embed.title ?? event.kind);
}

// The creation time ties a message to this event, not to an older event that reused its id.
function isPostOf(message: APIMessage, event: AuditEvent) {
	const [embed] = message.embeds;
	const match = FOOTER_ID.exec(embed?.footer?.text ?? '');

	return (
		Number(match?.[1]) === event.id &&
		Date.parse(embed?.timestamp ?? '') === event.createdAt.getTime()
	);
}

// Adopts messages that reached Discord before a failure kept their ids from being stored.
async function recoverPosted(
	messages: MessageGateway,
	channelId: string,
	pending: AuditEvent[],
	db: Database,
	telemetry: AuditTelemetry,
) {
	const recent = await messages.recentOwn(channelId, RECOVERY_WINDOW);
	const unposted: AuditEvent[] = [];

	for (const event of pending) {
		const message = recent.find((entry) => isPostOf(entry, event));

		if (!message) {
			unposted.push(event);

			continue;
		}

		await markPosted(db, telemetry, event, channelId, message.id, buildAuditEmbed(event));
	}

	return unposted;
}

function isDeployOf(event: AuditEvent, build: FirstPartyBuild) {
	const other = deployBuild(event.kind, event.data);

	return other?.repository === build.repository && other.commitSha === build.commitSha;
}

// CI publishes a build's addons one request at a time, so a deploy joins the newest post while
// that post lists only deploys of the same build.
async function openBatch(
	{ db, web }: Stores,
	channelId: string,
	event: AuditEvent,
): Promise<Batch | undefined> {
	const build = deployBuild(event.kind, event.data);

	if (!build) return;

	const [newest] = await db.select().from(auditPost).orderBy(desc(auditPost.eventId)).limit(1);

	if (!newest?.messageId || newest.channelId !== channelId) return;

	const rows = await db
		.select({ id: auditPost.eventId })
		.from(auditPost)
		.where(eq(auditPost.messageId, newest.messageId))
		.orderBy(asc(auditPost.eventId));
	const [first] = rows;

	if (!first || rows.length >= MAX_BATCH) return;

	// Posts are sequential, so the events from the batch's first one on are exactly its events.
	const events = await web.eventsAfter(first.id - 1, rows.length);
	const [head, ...rest] = events;
	const ids = new Set(rows.map((row) => row.id));

	if (
		!head ||
		events.length !== rows.length ||
		!events.every((entry) => ids.has(entry.id) && isDeployOf(entry, build))
	) {
		return;
	}

	return { messageId: newest.messageId, events: [head, ...rest] };
}

function messageOf(embed: APIEmbed): OutgoingMessage {
	return { body: { embeds: [embed], allowed_mentions: { parse: [] } } };
}

// A batch post that is gone, or whose edit Discord rejects, leaves the event a post of its own.
async function extend(
	messages: MessageGateway,
	channelId: string,
	batch: Batch,
	event: AuditEvent,
): Promise<string | undefined> {
	try {
		await messages.edit(
			channelId,
			batch.messageId,
			messageOf(buildDeployEmbed([...batch.events, event])),
		);

		return batch.messageId;
	} catch (error) {
		const failure = discordFailure(error);

		if (failure !== 'gone' && failure !== 'rejected') {
			throw error;
		}

		return;
	}
}

// A rejected embed would be rejected forever and stall every later event, so it falls back to a bare one.
function post(messages: MessageGateway, channelId: string, event: AuditEvent, embed: APIEmbed) {
	return messages.post(channelId, messageOf(embed), {
		nonce: eventNonce('a', event.id, event.createdAt),
		fallback: messageOf(buildFallbackEmbed(event)),
	});
}

/**
 * @description Creates the dispatcher that posts each moderation event once, in id order, to the audit log channel.
 * @param telemetry Where each posted event is also exported, as an OpenTelemetry log.
 * @param configured The audit log channel's id; `AUDIT_LOG_CHANNEL_ID` by default.
 * @returns The `audit_event` dispatcher.
 */
export function createAuditDispatcher(telemetry: AuditTelemetry, configured?: string): Dispatcher {
	// A failed send throws and ends the run, so no later event is ever posted ahead of it.
	async function postPending(context: DispatcherContext) {
		const channelId = configured ?? requireId('AUDIT_LOG_CHANNEL_ID');
		const messages = createMessageGateway(context.client.rest, context.client.user.id);

		for (let pending = await pendingEvents(context, channelId); pending.length;) {
			const unposted = await recoverPosted(
				messages,
				channelId,
				pending,
				context.db,
				telemetry,
			);

			for (const event of unposted) {
				const batch = await openBatch(context, channelId, event);
				const extended = batch
					? await extend(messages, channelId, batch, event)
					: undefined;
				const embed = buildAuditEmbed(event);
				const messageId = extended ?? (await post(messages, channelId, event, embed));

				await markPosted(context.db, telemetry, event, channelId, messageId, embed);
			}

			if (pending.length < PAGE) return;

			pending = await pendingEvents(context, channelId);
		}
	}

	return {
		name: 'audit',
		channel: 'audit_event',
		requires: ['AUDIT_LOG_CHANNEL_ID'],
		reconcile: postPending,
		handle: (_payload, context) => postPending(context),
	};
}

export default { createAuditDispatcher };
