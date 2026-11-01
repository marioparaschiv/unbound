import { moderationEventDataSchema } from '@unbound-app/contracts/admin';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { account, addon, moderationEvent, submission } from '~/db/schema';
import type { ReadDatabase } from '~/lib/bot/reads';
import type { ReviewNotice } from '~/lib/bot/types';

// Only `id`, `author_id` and `manifest` of `submission` are granted to the bot.
const discord = alias(account, 'discord');

/**
 * @description Reads human review decisions after an event id, oldest first, with who to tell.
 * @param db The read database.
 * @param afterId The newest event id already handled; `0` reads from the start.
 * @param limit The most decisions to read.
 * @returns The notices; CI deploys and rows that no longer parse are never returned.
 */
export async function readReviewNoticesAfter(
	db: ReadDatabase,
	afterId: number,
	limit: number,
): Promise<ReviewNotice[]> {
	// CI deploys are filtered here, not after the read, so they never fill a page and hide later decisions.
	const rows = await db
		.select({
			id: moderationEvent.id,
			addonId: moderationEvent.subjectId,
			kind: moderationEvent.kind,
			data: moderationEvent.data,
			note: moderationEvent.reason,
			createdAt: moderationEvent.createdAt,
			addonName: sql<string>`coalesce(${addon.name}, ${submission.manifest}->>'name', ${moderationEvent.subjectId})`,
			discordId: discord.accountId,
		})
		.from(moderationEvent)
		.leftJoin(submission, eq(submission.id, sql`${moderationEvent.data}->>'submissionId'`))
		.leftJoin(addon, eq(addon.id, moderationEvent.subjectId))
		.leftJoin(
			discord,
			and(eq(discord.userId, submission.authorId), eq(discord.providerId, 'discord')),
		)
		.where(
			and(
				eq(moderationEvent.kind, 'review.decided'),
				gt(moderationEvent.id, afterId),
				isNull(sql`${moderationEvent.data}->'build'`),
			),
		)
		.orderBy(asc(moderationEvent.id))
		.limit(limit);

	return rows.flatMap((row) => {
		const parsed = moderationEventDataSchema.safeParse({ kind: row.kind, data: row.data });

		if (!parsed.success || parsed.data.kind !== 'review.decided') {
			return [];
		}

		const { submissionKind, version, decision } = parsed.data.data;

		return [
			{
				eventId: row.id,
				addonId: row.addonId,
				addonName: row.addonName,
				version,
				submissionKind,
				decision,
				note: row.note,
				createdAt: row.createdAt,
				discordId: row.discordId,
			},
		];
	});
}

export default { readReviewNoticesAfter };
