import type { BotEvent } from '@unbound-app/contracts/bot';
import { botEventSchema } from '@unbound-app/contracts/bot';
import { createLogger } from '@unbound-app/logger';
import { z } from 'zod';

import { requireBotReader, toRowPage } from '~/lib/bot/feed';
import type { FeedPage, FeedRequest } from '~/lib/bot/feed';
import { BOT_FEED_DEFAULT_LIMIT } from '@unbound-app/contracts/bot';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { decodeCursor } from '~/lib/keyset';

type EventRow = Awaited<ReturnType<typeof queryEvents>>[number];

const logger = createLogger('Web', 'Bot');

// Event ids are unique, so the tie-breaking half of the position is always empty.
const EVENT_CURSOR = z.tuple([z.int(), z.literal('')]);

function queryEvents(ctx: AppContext, after: number, limit: number) {
	return ctx.db.query.moderationEvent.findMany({
		where: { id: { gt: after } },
		with: { actor: { columns: { id: true, name: true } } },
		orderBy: { id: 'asc' },
		limit: limit + 1,
	});
}

async function subjectNames(ctx: AppContext, rows: EventRow[]): Promise<Map<string, string>> {
	const ids = { addon: new Set<string>(), user: new Set<string>() };

	for (const row of rows) {
		ids[row.subjectType].add(row.subjectId);
	}

	const columns = { id: true, name: true } as const;
	const [addons, users] = await Promise.all([
		ctx.db.query.addon.findMany({ where: { id: { in: [...ids.addon] } }, columns }),
		ctx.db.query.user.findMany({ where: { id: { in: [...ids.user] } }, columns }),
	]);

	return new Map([
		...addons.map((row) => [`addon:${row.id}`, row.name] as const),
		...users.map((row) => [`user:${row.id}`, row.name] as const),
	]);
}

function toBotEvent(row: EventRow, names: Map<string, string>): BotEvent | undefined {
	const parsed = botEventSchema.safeParse({
		id: row.id,
		kind: row.kind,
		subjectType: row.subjectType,
		subjectId: row.subjectId,
		subjectName: names.get(`${row.subjectType}:${row.subjectId}`),
		actor: row.actor,
		data: row.data,
		reason: row.reason,
		createdAt: row.createdAt.toISOString(),
	});

	if (!parsed.success) {
		logger.warn(`Skipping moderation event ${row.id}, which no longer parses:`, parsed.error);

		return;
	}

	return parsed.data;
}

/**
 * @description Reads a page of the moderation log, oldest first. Rows that no longer match their
 * kind's schema are logged and skipped but still advance the cursor.
 * @param ctx The application context.
 * @param caller The caller; needs `bot:read`.
 * @param request The cursor and page size.
 * @returns The page.
 */
export async function listBotEvents(
	ctx: AppContext,
	caller: Caller,
	request: FeedRequest = {},
): Promise<FeedPage<BotEvent>> {
	requireBotReader(caller);

	const { after, limit = BOT_FEED_DEFAULT_LIMIT } = request;
	const [lastId] = after ? decodeCursor(after, EVENT_CURSOR) : [0];
	const rows = await queryEvents(ctx, Number(lastId), limit);
	const page = toRowPage(rows, limit, after, (row) => [row.id, '']);
	const names = await subjectNames(ctx, page.rows);

	return {
		items: page.rows.flatMap((row) => toBotEvent(row, names) ?? []),
		cursor: page.cursor,
		hasMore: page.hasMore,
	};
}

export default { listBotEvents };
