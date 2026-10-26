import type { APIEmbed, Client, Message, SendableChannels } from 'discord.js';
import type { AuditEvent } from '@unbound-app/web/bot';
import { DiscordAPIError } from 'discord.js';
import { max } from 'drizzle-orm';

import type { Dispatcher, DispatcherContext, Stores } from '~/dispatchers/types';
import { auditTelemetry, type AuditTelemetry } from '~/lib/audit-telemetry';
import { buildAuditEmbed, buildFallbackEmbed } from '~/dispatchers/audit-embed';
import { AUDIT_LOG_CHANNEL_ID } from '~/lib/constants';
import type { Database } from '~/db/database';
import { auditPost } from '~/db/schema';

// Posts are strictly sequential, so a post orphaned by a crash is always among the newest messages.
const RECOVERY_WINDOW = 100;
const PAGE = 100;
const FOOTER_ID = /^Event #(\d+) /;

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
	message: Message,
) {
	await db
		.insert(auditPost)
		.values({ eventId: event.id, channelId: message.channelId, messageId: message.id })
		.onConflictDoNothing();
	telemetry.emit(event, buildAuditEmbed(event).title ?? event.kind);
}

// The creation time ties a message to this event, not to an older event that reused its id.
function isPostOf(message: Message, event: AuditEvent, client: Client<true>) {
	if (message.author.id !== client.user.id) {
		return false;
	}

	const [embed] = message.embeds;
	const match = FOOTER_ID.exec(embed?.footer?.text ?? '');

	return (
		Number(match?.[1]) === event.id &&
		Date.parse(embed?.timestamp ?? '') === event.createdAt.getTime()
	);
}

// Adopts messages that reached Discord before a failure kept their ids from being stored.
async function recoverPosted(
	channel: SendableChannels,
	pending: AuditEvent[],
	context: DispatcherContext,
	telemetry: AuditTelemetry,
) {
	const messages = [...(await channel.messages.fetch({ limit: RECOVERY_WINDOW })).values()];
	const unposted: AuditEvent[] = [];

	for (const event of pending) {
		const message = messages.find((entry) => isPostOf(entry, event, context.client));

		if (!message) {
			unposted.push(event);

			continue;
		}

		await markPosted(context.db, telemetry, event, message);
	}

	return unposted;
}

// The nonce includes the creation time so a rebuilt database never collides with an old post.
function send(channel: SendableChannels, event: AuditEvent, embed: APIEmbed) {
	return channel.send({
		embeds: [embed],
		allowedMentions: { parse: [] },
		nonce: `a${event.id}.${event.createdAt.getTime().toString(36)}`,
		enforceNonce: true,
	});
}

// A 400 would reject the same embed forever and stall every later event, so it retries once bare.
async function post(channel: SendableChannels, event: AuditEvent) {
	try {
		return await send(channel, event, buildAuditEmbed(event));
	} catch (error) {
		if (!(error instanceof DiscordAPIError) || error.status !== 400) {
			throw error;
		}

		return send(channel, event, buildFallbackEmbed(event));
	}
}

/**
 * @description Creates the dispatcher that posts each moderation event once, in id order, to the audit log channel.
 * @param channelId The audit log channel's id.
 * @param telemetry Where each posted event is also exported, as an OpenTelemetry log.
 * @returns The `audit_event` dispatcher.
 */
export function createAuditDispatcher(
	channelId: string = AUDIT_LOG_CHANNEL_ID,
	telemetry: AuditTelemetry = auditTelemetry,
): Dispatcher {
	async function resolveChannel(client: Client<true>) {
		const channel = await client.channels.fetch(channelId);

		if (!channel?.isSendable()) {
			throw new Error(`Audit log channel ${channelId} is missing or cannot be sent to.`);
		}

		return channel;
	}

	// A failed send throws and ends the run, so no later event is ever posted ahead of it.
	async function postPending(context: DispatcherContext) {
		for (let pending = await pendingEvents(context, channelId); pending.length;) {
			const channel = await resolveChannel(context.client);
			const unposted = await recoverPosted(channel, pending, context, telemetry);

			for (const event of unposted) {
				await markPosted(context.db, telemetry, event, await post(channel, event));
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

export const auditDispatcher = createAuditDispatcher();

export default { createAuditDispatcher, auditDispatcher };
