import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import type { ReviewNotice } from '@unbound-app/web/bot';
import type { APIEmbed, Client } from 'discord.js';
import { max } from 'drizzle-orm';

import type { Dispatcher, DispatcherContext, Stores } from '~/dispatchers/types';
import { reviewNotice, type ReviewNoticeOutcome } from '~/db/schema';
import { EMBED_LIMITS, quote } from '~/dispatchers/audit-embed';
import { DECISIONS } from '~/dispatchers/audit-kinds';
import { truncate } from '~/lib/discord-messages';
import type { Database } from '~/db/database';
import { SITE_URL } from '~/lib/constants';

const PAGE = 100;
const SUBMISSIONS = { listing: 'Your new addon', update: 'Your update to' } as const;
// The author blocks DMs from the bot, shares no server with it, or no longer exists: no retry helps.
const UNDELIVERABLE = new Set<DiscordAPIError['code']>([
	RESTJSONErrorCodes.CannotSendMessagesToThisUser,
	RESTJSONErrorCodes.UnknownUser,
]);

type Handled = { outcome: ReviewNoticeOutcome; messageId?: string };

/**
 * @description Renders a review decision as the DM its author gets: the outcome, the reviewer's note and where to look next.
 * @param notice The review decision.
 * @param siteUrl The site origin links point at.
 * @returns The embed, within Discord's limits.
 */
export function renderReviewNotice(notice: ReviewNotice, siteUrl: string = SITE_URL): APIEmbed {
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

// An empty `review_notice` means notices were never enabled here, so the newest event becomes the
// floor and enabling DMs nobody about old decisions.
async function recordFloor({ db, web }: Stores) {
	const floor = await web.newestEventId();

	await record(db, floor, { outcome: 'floor' });

	return floor;
}

// Notices are handled one at a time in event id order, so the newest handled id is the whole cursor.
async function cursor(stores: Stores) {
	const [row] = await stores.db.select({ last: max(reviewNotice.eventId) }).from(reviewNotice);

	return row?.last ?? (await recordFloor(stores));
}

// The nonce dedupes a quick retry; a crash between this send and its row re-sends on a later run,
// which can DM the author twice. That is accepted.
async function deliver(client: Client<true>, notice: ReviewNotice): Promise<Handled> {
	if (!notice.discordId) {
		return { outcome: 'unlinked' };
	}

	try {
		const channel = await client.users.createDM(notice.discordId);
		const message = await channel.send({
			embeds: [renderReviewNotice(notice)],
			allowedMentions: { parse: [] },
			nonce: `r${notice.eventId}.${notice.createdAt.getTime().toString(36)}`,
			enforceNonce: true,
		});

		return { outcome: 'sent', messageId: message.id };
	} catch (error) {
		if (!(error instanceof DiscordAPIError) || !UNDELIVERABLE.has(error.code)) {
			throw error;
		}

		return { outcome: 'undeliverable' };
	}
}

// Strictly sequential: a failed send throws and ends the run, and the next run resumes at the cursor.
async function notifyPending(context: DispatcherContext) {
	for (;;) {
		const notices = await context.web.reviewNoticesAfter(await cursor(context), PAGE);

		if (!notices.length) return;

		for (const notice of notices) {
			await record(context.db, notice.eventId, await deliver(context.client, notice));
		}
	}
}

/** DMs each human review decision to the submission's author once, in event order. */
export const reviewNoticesDispatcher: Dispatcher = {
	name: 'review-notices',
	channel: 'audit_event',
	requires: [],
	/**
	 * @description DMs every review decision after the cursor.
	 * @param context The dispatcher's stores and Discord client.
	 * @returns Resolves once every pending decision is handled.
	 */
	reconcile: (context) => notifyPending(context),
	/**
	 * @description DMs every review decision after the cursor; the payload's event id adds nothing.
	 * @param _payload The `audit_event` payload.
	 * @param context The dispatcher's stores and Discord client.
	 * @returns Resolves once every pending decision is handled.
	 */
	handle: (_payload, context) => notifyPending(context),
};

export default { renderReviewNotice, reviewNoticesDispatcher };
