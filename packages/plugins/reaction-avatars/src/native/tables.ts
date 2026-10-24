import type { NativeCancelablePromise, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';

import type { Session } from '~/native/session';
import { NativeClass } from '~/constants';
import { key } from '~/native/views';

// A table re-measures its rows on an empty `beginUpdates`/`endUpdates` pair; `dirty` marks one as needed.
export type TableLayout = {
	dirty: boolean;
	hooked: boolean;
	pending: NativeCancelablePromise<unknown[]> | null;
	scheduled: boolean;
	table: NativeObjectHandle;
};

/**
 * @description Gets the row-height bookkeeping for a message table, creating it on first use.
 * @param session The running session.
 * @param table The `DCDTableView`.
 * @returns Its entry.
 */
export function tableLayout(session: Session, table: NativeObjectHandle): TableLayout {
	const tableKey = key(session.objc, table);
	const existing = session.tables.get(tableKey);

	if (existing) return existing;

	const entry = { dirty: true, hooked: false, pending: null, scheduled: false, table };

	session.tables.set(tableKey, entry);

	return entry;
}

/**
 * @description Marks a table's row heights as stale.
 * @param session The running session.
 * @param tableKey The table's key.
 * @returns The table's entry, or `undefined` when it is not tracked.
 */
export function markTableDirty(session: Session, tableKey: string): TableLayout | undefined {
	const entry = session.tables.get(tableKey);

	if (entry) entry.dirty = true;

	return entry;
}

function applyTableLayout(session: Session, entry: TableLayout): void {
	if (!entry.dirty || entry.pending) return;

	const { signal } = session;

	entry.dirty = false;

	try {
		const pending = session.objc.batch([
			{ target: entry.table, selector: 'beginUpdates', args: [] },
			{ target: entry.table, selector: 'endUpdates', args: [] },
		]);

		entry.pending = pending;
		void pending.then(
			() => {
				if (entry.pending !== pending) return;

				entry.pending = null;

				if (!signal.aborted && entry.dirty) scheduleTableLayout(session, entry);
			},
			() => {
				if (entry.pending !== pending) return;

				entry.pending = null;

				if (!signal.aborted) entry.dirty = true;
			},
		);
	} catch {
		entry.dirty = true;
	}
}

/**
 * @description Re-measures a table's rows on the next tick, once however often it is asked.
 * @param session The running session.
 * @param entry The table's entry.
 */
export function scheduleTableLayout(session: Session, entry: TableLayout): void {
	if (entry.scheduled) return;

	entry.scheduled = true;

	setTimeout(() => {
		entry.scheduled = false;

		if (!session.signal.aborted && entry.dirty) applyTableLayout(session, entry);
	}, 0);
}

/**
 * @description Re-measures a table's rows when they were marked stale.
 * @param session The running session.
 * @param tableKey The table's key.
 */
export function flushTableLayout(session: Session, tableKey: string): void {
	const entry = session.tables.get(tableKey);

	if (entry?.dirty) scheduleTableLayout(session, entry);
}

/**
 * @description Re-measures a table's stale rows after each of its own layout passes.
 * @param session The running session.
 * @param table The `DCDTableView`.
 */
export function hookTableLayout(session: Session, table: NativeObjectHandle): void {
	const entry = tableLayout(session, table);

	if (entry.hooked) return;

	try {
		session.tableHooks.push(
			session.objc.hook(
				NativeClass.table,
				'layoutSubviews',
				{
					after: () => {
						if (entry.dirty) scheduleTableLayout(session, entry);
					},
				},
				{ instance: table, thread: 'main' },
			),
		);
		entry.hooked = true;
	} catch {
		// Without the hook the rows still re-measure when a reaction layout schedules it.
	}
}

/**
 * @description Unhooks every table and re-measures its rows once their reaction layouts are restored.
 * @param session The running session.
 * @param restoreRows Restores the reaction layouts inside one table.
 */
export function restoreTables(session: Session, restoreRows: (tableKey: string) => void): void {
	for (const hook of session.tableHooks.splice(0)) hook.remove();

	for (const [tableKey, entry] of session.tables) {
		entry.pending?.cancel();
		entry.pending = null;
		restoreRows(tableKey);
		entry.dirty = false;
		safeInvoke(session.objc, entry.table, 'beginUpdates');
		safeInvoke(session.objc, entry.table, 'endUpdates');
	}

	session.tables.clear();
}
