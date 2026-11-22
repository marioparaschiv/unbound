import {
	fitRowUpdate,
	rowUpdateBreadcrumb,
	summariseRowUpdate,
	type ChangedRow,
} from '~/diagnostics/chat-row-updates';
import { findByProps } from '~/metro/lookups';
import { after, before } from '~/patcher/api';

type RowUpdate = { rows?: ChangedRow[]; forceReload?: boolean };

/** Discord's native chat component instance, a host component ref. */
type ChatView = { _nativeTag?: number };

type NativeChatUtils = {
	updateRows(view: ChatView, update: RowUpdate): void;
	clearRows(view: ChatView): number | undefined;
};

/** How many rows a native chat view holds by what it was sent, and its number in the breadcrumbs. */
type TrackedView = { id: number; rows: number | undefined };

const views = new WeakMap<ChatView, TrackedView>();
let nextViewId = 1;

function tracked(view: ChatView): TrackedView {
	let entry = views.get(view);

	if (!entry) {
		entry = { id: nextViewId++, rows: 0 };
		views.set(view, entry);
	}

	return entry;
}

/**
 * @description Tracks every update Discord sends to its native chat views and fits one whose indices run past the rows
 * the view holds, which Discord's native chat would otherwise trap on, recording each in the crash breadcrumbs.
 * @param record Keeps one breadcrumb line.
 * @returns A function that stops guarding, or `undefined` when Discord moved its chat helpers.
 */
export function guardChatRows(record: (line: string) => void): (() => void) | undefined {
	const utils = findByProps('updateRows', 'clearRows', 'fadeIn') as NativeChatUtils | undefined;

	if (!utils) {
		return undefined;
	}

	const unpatchClear = after(utils, 'clearRows', ({ args: [view] }) => {
		if (typeof view !== 'object' || view === null) return;

		const entry = tracked(view);

		entry.rows = 0;
		record(`chat rows: view ${entry.id} cleared`);
	});

	const unpatchUpdate = before(utils, 'updateRows', ({ args: [view, update] }) => {
		const rows = update?.rows;

		if (typeof view !== 'object' || view === null || !Array.isArray(rows)) return;

		const entry = tracked(view);
		const full = Boolean(update.forceReload);
		const summary = summariseRowUpdate(rows, entry.rows, full);
		const held = full ? 0 : entry.rows;

		if (summary.fits === false && held !== undefined) {
			const fitted = fitRowUpdate(rows, held);

			entry.rows = summariseRowUpdate(fitted, held, false).rowsAfter;
			record(rowUpdateBreadcrumb(entry.id, summary, full, true));

			return [view, { ...update, rows: fitted }];
		}

		entry.rows = summary.rowsAfter;
		record(rowUpdateBreadcrumb(entry.id, summary, full));
	});

	return () => {
		unpatchClear();
		unpatchUpdate();
	};
}

export default { guardChatRows };
