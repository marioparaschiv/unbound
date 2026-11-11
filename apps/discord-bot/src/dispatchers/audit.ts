import type { AuditEvent } from '@unbound-app/web/bot';
import type { APIEmbed, APIMessage } from 'discord.js';
import { asc, desc, eq, max } from 'drizzle-orm';

import {
	buildAuditEmbed,
	buildDeployEmbed,
	buildFallbackEmbed,
	type DeployBatch,
} from '~/dispatchers/audit-embed';
import {
	discordFailure,
	eventNonce,
	type MessageGateway,
	type OutgoingMessage,
} from '~/lib/discord-messages';
import { deployBuild, type FirstPartyBuild } from '~/dispatchers/audit-kinds';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { AuditTelemetry } from '~/lib/audit-telemetry';
import { createEventCursor } from '~/lib/event-cursor';
import type { Database } from '~/db/database';
import { auditPost } from '~/db/schema';

export type AuditOptions = {
	channelId: string;
	/** The site origin each embed's subject link points at. */
	siteUrl: string;
	/** Where each posted event is also exported, as an OpenTelemetry log. */
	telemetry: AuditTelemetry;
	messages: MessageGateway;
};

// Posts are strictly sequential, so a post orphaned by a crash is always among the newest messages.
const RECOVERY_WINDOW = 100;
// A batch post's footer reads `Events #first–#last`; it was last edited for its last event.
const FOOTER_ID = /^Events? #(?:\d+–#)?(\d+) /;
const MAX_BATCH = 20;

type Batch = {
	messageId: string;
	events: DeployBatch;
};

async function lastPosted(db: Database) {
	const [row] = await db.select({ last: max(auditPost.eventId) }).from(auditPost);

	return row?.last ?? undefined;
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
async function recoverPosted(options: AuditOptions, pending: AuditEvent[], db: Database) {
	const { messages, channelId, siteUrl, telemetry } = options;
	const recent = await messages.recentOwn(channelId, RECOVERY_WINDOW);
	const unposted: AuditEvent[] = [];

	for (const event of pending) {
		const message = recent.find((entry) => isPostOf(entry, event));

		if (!message) {
			unposted.push(event);

			continue;
		}

		await markPosted(
			db,
			telemetry,
			event,
			channelId,
			message.id,
			buildAuditEmbed(event, siteUrl),
		);
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
	{ db, web }: DispatcherContext,
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
	{ messages, channelId, siteUrl }: AuditOptions,
	batch: Batch,
	event: AuditEvent,
): Promise<string | undefined> {
	try {
		await messages.edit(
			channelId,
			batch.messageId,
			messageOf(buildDeployEmbed([...batch.events, event], siteUrl)),
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
 * @param options The channel, the site origin, the telemetry and the bot's Discord messages.
 * @returns The `audit_event` dispatcher.
 */
export function createAuditDispatcher(options: AuditOptions): Dispatcher {
	const { channelId, siteUrl, telemetry, messages } = options;
	// The floor row has no message: the newest event when the log was first enabled, never posted.
	const cursor = createEventCursor({
		table: {
			last: lastPosted,
			async floor(db, eventId) {
				await db
					.insert(auditPost)
					.values({ eventId, channelId, messageId: null })
					.onConflictDoNothing();
			},
		},
		after: (web, eventId, limit) => web.eventsAfter(eventId, limit),
	});

	// A failed send throws and ends the run, so no later event is ever posted ahead of it.
	function postPending(context: DispatcherContext) {
		return cursor.drain(context, async (pending) => {
			const unposted = await recoverPosted(options, pending, context.db);

			for (const event of unposted) {
				const batch = await openBatch(context, channelId, event);
				const extended = batch ? await extend(options, batch, event) : undefined;
				const embed = buildAuditEmbed(event, siteUrl);
				const messageId = extended ?? (await post(messages, channelId, event, embed));

				await markPosted(context.db, telemetry, event, channelId, messageId, embed);
			}
		});
	}

	return {
		name: 'audit',
		channel: 'audit_event',
		reconcile: postPending,
		handle: (_payload, context) => postPending(context),
	};
}

export default { createAuditDispatcher };
