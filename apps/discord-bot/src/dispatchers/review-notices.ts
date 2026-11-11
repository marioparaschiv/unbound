import type { ReviewNotice } from '@unbound-app/web/bot';
import type { APIEmbed } from 'discord.js';
import { max } from 'drizzle-orm';

import { discordFailure, eventNonce, type MessageGateway } from '~/lib/discord-messages';
import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import { reviewNotice, type ReviewNoticeOutcome } from '~/db/schema';
import { EMBED_LIMITS, quote, truncate } from '~/lib/message-text';
import { createEventCursor } from '~/lib/event-cursor';
import { DECISIONS } from '~/dispatchers/audit-kinds';
import type { Database } from '~/db/database';

export type ReviewNoticesOptions = {
	/** The site origin each notice links to. */
	siteUrl: string;
	messages: MessageGateway;
};

const SUBMISSIONS = { listing: 'Your new addon', update: 'Your update to' } as const;

type Handled = { outcome: ReviewNoticeOutcome; messageId?: string };

/**
 * @description Renders a review decision as the DM its author gets: the outcome, the reviewer's note and where to look next.
 * @param notice The review decision.
 * @param siteUrl The site origin links point at.
 * @returns The embed, within Discord's limits.
 */
export function renderReviewNotice(notice: ReviewNotice, siteUrl: string): APIEmbed {
	const decision = DECISIONS[notice.decision];
	const approved = notice.decision === 'approved';
	const url = approved
		? `${siteUrl}/addons/${encodeURIComponent(notice.addonId)}`
		: `${siteUrl}/dashboard`;
	const link = approved ? `[View the addon](${url})` : `[Open your dashboard](${url})`;
	const room = EMBED_LIMITS.description - link.length - 2;
	const note = notice.note?.trim() ? truncate(quote(notice.note), room) : undefined;
	const title = `${SUBMISSIONS[notice.submissionKind]} ${notice.addonName} ${notice.version} ${decision.outcome}`;

	return {
		title: truncate(title, EMBED_LIMITS.title),
		url,
		description: [note, link].filter(Boolean).join('\n\n'),
		color: decision.colour,
		timestamp: notice.createdAt.toISOString(),
	};
}

async function record(db: Database, eventId: number, { outcome, messageId }: Handled) {
	await db
		.insert(reviewNotice)
		.values({ eventId, outcome, messageId: messageId ?? null })
		.onConflictDoNothing();
}

// The floor keeps enabling notices from DMing anybody about old decisions.
const cursor = createEventCursor({
	table: {
		async last(db) {
			const [row] = await db.select({ last: max(reviewNotice.eventId) }).from(reviewNotice);

			return row?.last ?? undefined;
		},
		floor: (db, eventId) => record(db, eventId, { outcome: 'floor' }),
	},
	after: (web, eventId, limit) => web.reviewNoticesAfter(eventId, limit),
});

// The nonce dedupes a quick retry; a crash between this send and its row re-sends on a later run,
// which can DM the author twice. That is accepted.
async function deliver(
	{ messages, siteUrl }: ReviewNoticesOptions,
	notice: ReviewNotice,
): Promise<Handled> {
	if (!notice.discordId) {
		return { outcome: 'unlinked' };
	}

	try {
		const messageId = await messages.dm(
			notice.discordId,
			{
				body: {
					embeds: [renderReviewNotice(notice, siteUrl)],
					allowed_mentions: { parse: [] },
				},
			},
			{ nonce: eventNonce('r', notice.eventId, notice.createdAt) },
		);

		return { outcome: 'sent', messageId };
	} catch (error) {
		// No retry helps an author who blocks the bot, shares no server with it, or no longer exists.
		if (discordFailure(error) !== 'undeliverable') {
			throw error;
		}

		return { outcome: 'undeliverable' };
	}
}

/**
 * @description Creates the dispatcher that DMs each human review decision to the submission's author once, in event order.
 * @param options The site origin and the bot's Discord messages.
 * @returns The `audit_event` dispatcher.
 */
export function createReviewNoticesDispatcher(options: ReviewNoticesOptions): Dispatcher {
	// Strictly sequential: a failed send throws and ends the run, and the next run resumes at the cursor.
	function notifyPending(context: DispatcherContext) {
		return cursor.drain(context, async (notices) => {
			for (const notice of notices) {
				await record(context.db, notice.eventId, await deliver(options, notice));
			}
		});
	}

	return {
		name: 'review-notices',
		channel: 'audit_event',
		reconcile: notifyPending,
		// The payload's event id adds nothing: every decision after the cursor is handled.
		handle: (_payload, context) => notifyPending(context),
	};
}

export default { renderReviewNotice, createReviewNoticesDispatcher };
