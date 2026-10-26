import { max } from 'drizzle-orm';

import type { ReadDatabase } from '~/lib/bot/reads';
import type { AuditEvent } from '~/lib/bot/types';
import { moderationEvent } from '~/db/schema';

type EventRow = Awaited<ReturnType<typeof queryEvents>>[number];

const NAME_COLUMNS = { id: true, name: true } as const;

function queryEvents(db: ReadDatabase, afterId: number, limit: number) {
	return db.query.moderationEvent.findMany({
		where: { id: { gt: afterId } },
		columns: {
			id: true,
			kind: true,
			subjectType: true,
			subjectId: true,
			data: true,
			reason: true,
			createdAt: true,
		},
		with: { actor: { columns: NAME_COLUMNS } },
		orderBy: { id: 'asc' },
		limit,
	});
}

async function subjectNames(db: ReadDatabase, rows: EventRow[]): Promise<Map<string, string>> {
	const ids = { addon: new Set<string>(), user: new Set<string>() };

	for (const row of rows) {
		ids[row.subjectType].add(row.subjectId);
	}

	const [addons, users] = await Promise.all([
		ids.addon.size
			? db.query.addon.findMany({
					where: { id: { in: [...ids.addon] } },
					columns: NAME_COLUMNS,
				})
			: [],
		ids.user.size
			? db.query.user.findMany({
					where: { id: { in: [...ids.user] } },
					columns: NAME_COLUMNS,
				})
			: [],
	]);

	return new Map([
		...addons.map((row) => [`addon:${row.id}`, row.name] as const),
		...users.map((row) => [`user:${row.id}`, row.name] as const),
	]);
}

/**
 * @description Reads moderation events after an id, oldest first. Ids are drawn in commit order, so
 * a reader that saw an id has seen every lower one.
 * @param db The read database.
 * @param afterId The newest id already read; `0` reads from the start.
 * @param limit The most events to read.
 * @returns The events, with the actor and the subject's current name.
 */
export async function readEventsAfter(
	db: ReadDatabase,
	afterId: number,
	limit: number,
): Promise<AuditEvent[]> {
	const rows = await queryEvents(db, afterId, limit);
	const names = await subjectNames(db, rows);

	return rows.map((row) => ({
		...row,
		subjectName: names.get(`${row.subjectType}:${row.subjectId}`) ?? null,
	}));
}

/**
 * @description Reads the newest moderation event's id.
 * @param db The read database.
 * @returns The id, or `0` when the log is empty.
 */
export async function readNewestEventId(db: ReadDatabase): Promise<number> {
	const [row] = await db.select({ id: max(moderationEvent.id) }).from(moderationEvent);

	return row?.id ?? 0;
}

export default { readEventsAfter, readNewestEventId };
