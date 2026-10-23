import type { SyncDocument, SyncState } from '@unbound-app/contracts/sync';
import { emptySyncDocument } from '@unbound-app/contracts/sync';
import { and, eq } from 'drizzle-orm';

import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import { syncDocument } from '~/db/schema';

type SyncRow = typeof syncDocument.$inferSelect;

function toState(row: SyncRow): SyncState {
	return {
		revision: row.revision,
		updatedAt: row.updatedAt.toISOString(),
		document: row.document,
	};
}

/**
 * @description Reads a user's Cloud Sync document.
 * @param ctx The application context.
 * @param userId The owner.
 * @returns The stored state, or revision `0` with an empty document when nothing is stored.
 */
export function getSyncState(ctx: AppContext, userId: string): SyncState {
	const row = ctx.db.select().from(syncDocument).where(eq(syncDocument.userId, userId)).get();

	if (!row) {
		return { revision: 0, updatedAt: null, document: emptySyncDocument() };
	}

	return toState(row);
}

/**
 * @description Saves a user's Cloud Sync document if it was merged against the stored revision.
 * @param ctx The application context.
 * @param userId The owner.
 * @param revision The revision the document was merged against; `0` when nothing was stored.
 * @param document The stripped document.
 * @returns The new state. Throws `sync_conflict` when another save landed first.
 */
export function saveSyncDocument(
	ctx: AppContext,
	userId: string,
	revision: number,
	document: SyncDocument,
): SyncState {
	const updatedAt = ctx.now();
	const values = { revision: revision + 1, document, updatedAt };

	// Both statements only write when the stored revision still matches, so a lost race writes nothing.
	const row =
		revision === 0
			? ctx.db
					.insert(syncDocument)
					.values({ userId, ...values })
					.onConflictDoNothing()
					.returning()
					.get()
			: ctx.db
					.update(syncDocument)
					.set(values)
					.where(
						and(eq(syncDocument.userId, userId), eq(syncDocument.revision, revision)),
					)
					.returning()
					.get();

	if (!row) {
		throw new ApiError('sync_conflict', 'The Cloud Sync document changed. Sync again.');
	}

	return toState(row);
}

/**
 * @description Deletes a user's Cloud Sync document.
 * @param ctx The application context.
 * @param userId The owner.
 * @returns Whether there was a document to delete.
 */
export function deleteSyncDocument(ctx: AppContext, userId: string): boolean {
	const deleted = ctx.db
		.delete(syncDocument)
		.where(eq(syncDocument.userId, userId))
		.returning({ userId: syncDocument.userId })
		.all();

	return deleted.length > 0;
}

export default { getSyncState, saveSyncDocument, deleteSyncDocument };
