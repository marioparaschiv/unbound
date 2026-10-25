import type { APIEmbed, Client, Message, SendableChannels } from 'discord.js';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DiscordAPIError } from 'discord.js';

import { buildAuditEmbed, buildFallbackEmbed, type AuditEventRow } from '~/dispatchers/audit-embed';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import { AUDIT_LOG_CHANNEL_ID } from '~/lib/constants';
import type { Database } from '~/db/database';
import { auditEvent } from '~/db/schema';

// Posts are strictly sequential, so a post orphaned by a crash is always among the newest messages.
const RECOVERY_WINDOW = 100;
const FOOTER_ID = /^Event #(\d+) /;

function pendingEvents(db: Database) {
	return db
		.select()
		.from(auditEvent)
		.where(isNull(auditEvent.messageId))
		.orderBy(asc(auditEvent.id));
}

async function markPosted(db: Database, id: number, message: Message) {
	await db
		.update(auditEvent)
		.set({ channelId: message.channelId, messageId: message.id })
		.where(and(eq(auditEvent.id, id), isNull(auditEvent.messageId)));
}

// The creation time ties a message to this event, not to an older event that reused its id.
function isPostOf(message: Message, event: AuditEventRow, client: Client<true>) {
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
	pending: AuditEventRow[],
	context: DispatcherContext,
) {
	const messages = [...(await channel.messages.fetch({ limit: RECOVERY_WINDOW })).values()];
	const unposted: AuditEventRow[] = [];

	for (const event of pending) {
		const message = messages.find((entry) => isPostOf(entry, event, context.client));

		if (!message) {
			unposted.push(event);

			continue;
		}

		await markPosted(context.db, event.id, message);
	}

	return unposted;
}

// The nonce includes the creation time so a rebuilt database never collides with an old post.
function send(channel: SendableChannels, event: AuditEventRow, embed: APIEmbed) {
	return channel.send({
		embeds: [embed],
		allowedMentions: { parse: [] },
		nonce: `a${event.id}.${event.createdAt.getTime().toString(36)}`,
		enforceNonce: true,
	});
}

// A 400 would reject the same embed forever and stall every later event, so it retries once bare.
async function post(channel: SendableChannels, event: AuditEventRow) {
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
 * @description Creates the dispatcher that posts each audit event once, in id order, to the audit log channel.
 * @param channelId The audit log channel's id.
 * @returns The `audit_event` dispatcher.
 */
export function createAuditDispatcher(channelId: string = AUDIT_LOG_CHANNEL_ID): Dispatcher {
	async function resolveChannel(client: Client<true>) {
		const channel = await client.channels.fetch(channelId);

		if (!channel?.isSendable()) {
			throw new Error(`Audit log channel ${channelId} is missing or cannot be sent to.`);
		}

		return channel;
	}

	// A failed send throws and ends the run, so no later event is ever posted ahead of it.
	async function postPending(context: DispatcherContext) {
		const pending = await pendingEvents(context.db);

		if (!pending.length) return;

		const channel = await resolveChannel(context.client);
		const unposted = await recoverPosted(channel, pending, context);

		for (const event of unposted) {
			const message = await post(channel, event);

			await markPosted(context.db, event.id, message);
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
