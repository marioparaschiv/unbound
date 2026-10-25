import type { EventFeedItem } from '~/lib/feed/types';
import type { Transaction } from '~/db/database';
import { auditEvent } from '~/db/schema';

/**
 * @description Appends moderation events; a replayed event is skipped so its posted message ids survive.
 * @param tx The page's transaction.
 * @param items The page's event items.
 * @returns Resolves once the page is written.
 */
export async function ingestEvents(tx: Transaction, items: EventFeedItem[]): Promise<void> {
	if (!items.length) return;

	const rows = items.map((item) => ({
		id: item.id,
		kind: item.kind,
		subjectType: item.subjectType,
		subjectId: item.subjectId,
		subjectName: item.subjectName ?? null,
		actor: item.actor,
		data: item.data,
		reason: item.reason,
		createdAt: new Date(item.createdAt),
	}));

	await tx.insert(auditEvent).values(rows).onConflictDoNothing();
}

export default { ingestEvents };
