import type { Client, Message, SendableChannels } from 'discord.js';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { buildAuditEmbed, type AuditEventRow } from '~/dispatchers/audit-embed';
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

function postedEventId(message: Message, client: Client<true>) {
	if (message.author.id !== client.user.id) return;

	const match = FOOTER_ID.exec(message.embeds[0]?.footer?.text ?? '');

	return match ? Number(match[1]) : undefined;
}

// Adopts messages that reached Discord before a crash kept their ids from being stored.
async function recoverPosted(
	channel: SendableChannels,
	pending: AuditEventRow[],
	context: DispatcherContext,
) {
	const ids = new Set(pending.map((event) => event.id));
	const recovered = new Set<number>();
	const messages = await channel.messages.fetch({ limit: RECOVERY_WINDOW });

	for (const message of messages.values()) {
		const id = postedEventId(message, context.client);

		if (id === undefined || !ids.has(id) || recovered.has(id)) {
			continue;
		}

		await markPosted(context.db, id, message);
		recovered.add(id);
	}

	return pending.filter((event) => !recovered.has(event.id));
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
	async function postPending(context: DispatcherContext, recover: boolean) {
		const pending = await pendingEvents(context.db);

		if (!pending.length) return;

		const channel = await resolveChannel(context.client);
		const unposted = recover ? await recoverPosted(channel, pending, context) : pending;

		for (const event of unposted) {
			const message = await channel.send({
				embeds: [buildAuditEmbed(event)],
				allowedMentions: { parse: [] },
				nonce: `audit-${event.id}`,
				enforceNonce: true,
			});

			await markPosted(context.db, event.id, message);
		}
	}

	return {
		name: 'audit',
		channel: 'audit_event',
		reconcile: (context) => postPending(context, true),
		handle: (_payload, context) => postPending(context, false),
	};
}

export const auditDispatcher = createAuditDispatcher();

export default { createAuditDispatcher, auditDispatcher };
