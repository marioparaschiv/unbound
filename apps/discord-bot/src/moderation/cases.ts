import { and, desc, eq, isNull, lte } from 'drizzle-orm';

import type { Database } from '~/db/database';
import type { ModCase } from '~/lib/mod-case';
import { modCase } from '~/db/schema';

/** A case before it is numbered and posted. */
export type CaseDraft = Pick<
	ModCase,
	'action' | 'userId' | 'userName' | 'moderatorId' | 'moderatorName' | 'reason'
> & { expiresAt?: Date | null; createdAt?: Date };

/**
 * @description Numbers and stores a case; a ban or unban first closes the user's open bans, so only the newest can expire.
 * @param db The bot database.
 * @param draft The case.
 * @returns The stored case.
 */
export async function insertCase(db: Database, draft: CaseDraft): Promise<ModCase> {
	return db.transaction(async (tx) => {
		if (draft.action === 'ban' || draft.action === 'unban') {
			await tx
				.update(modCase)
				.set({ closedAt: draft.createdAt ?? new Date() })
				.where(
					and(
						eq(modCase.userId, draft.userId),
						eq(modCase.action, 'ban'),
						isNull(modCase.closedAt),
					),
				);
		}

		const [row] = await tx.insert(modCase).values(draft).returning();

		if (!row) {
			throw new Error(`Failed to store a ${draft.action} case for user ${draft.userId}.`);
		}

		return row;
	});
}

/**
 * @description Finds a case by its number.
 * @param db The bot database.
 * @param id The case number.
 * @returns The case, or undefined.
 */
export async function getCase(db: Database, id: number): Promise<ModCase | undefined> {
	const [row] = await db.select().from(modCase).where(eq(modCase.id, id));

	return row;
}

/**
 * @description Lists a user's cases, newest first.
 * @param db The bot database.
 * @param userId The user.
 * @param action Only cases of this action, when given.
 * @returns The cases.
 */
export function listCases(
	db: Database,
	userId: string,
	action?: ModCase['action'],
): Promise<ModCase[]> {
	const byUser = eq(modCase.userId, userId);

	return db
		.select()
		.from(modCase)
		.where(action ? and(byUser, eq(modCase.action, action)) : byUser)
		.orderBy(desc(modCase.id));
}

/**
 * @description Changes the fields of a case.
 * @param db The bot database.
 * @param id The case number.
 * @param changes The reason, log post or closing time.
 * @returns The changed case, or undefined when there is none.
 */
export async function updateCase(
	db: Database,
	id: number,
	changes: Partial<Pick<ModCase, 'reason' | 'closedAt' | 'logChannelId' | 'logMessageId'>>,
): Promise<ModCase | undefined> {
	const [row] = await db.update(modCase).set(changes).where(eq(modCase.id, id)).returning();

	return row;
}

/**
 * @description Lists the temporary bans whose time is up and that nothing has lifted yet.
 * @param db The bot database.
 * @param now The current time.
 * @returns The due bans, oldest first.
 */
export function listDueBans(db: Database, now: Date): Promise<ModCase[]> {
	return db
		.select()
		.from(modCase)
		.where(
			and(eq(modCase.action, 'ban'), isNull(modCase.closedAt), lte(modCase.expiresAt, now)),
		)
		.orderBy(modCase.id);
}

export default { insertCase, getCase, listCases, updateCase, listDueBans };
