import type { MentionIndex } from '~/lib/mention-index';

type IndexState = Pick<MentionIndex, 'exhausted' | 'isUnresolved' | 'isSettledEmpty'>;

export type WaitingTarget = { id?: string; channelId?: string };

export type RetryPlan = { reschedule: string[]; drop: string[] };

/**
 * @description Decides whether a rendered message should wait for a later store change.
 * @param index The mention index.
 * @param id The message ID, if the cell has one.
 * @param hydrated Whether the message was found in the store.
 * @returns Whether the cell should wait for its mentions to resolve.
 */
export function shouldWait(index: IndexState, id: string | undefined, hydrated: boolean): boolean {
	if (!id) return false;

	return !index.exhausted(id) && (!hydrated || index.isUnresolved(id));
}

/**
 * @description Decides whether a message is done after one render, with no settle render.
 * @param index The mention index.
 * @param id The message ID, if the cell has one.
 * @param hydrated Whether the message was found in the store.
 * @param drawn Whether the cell already shows mention images.
 * @returns Whether the message has no mentions, all resolved, and nothing to restore.
 */
export function isSettledWithoutMentions(
	index: IndexState,
	id: string | undefined,
	hydrated: boolean,
	drawn: boolean,
): boolean {
	if (!id) return false;

	return hydrated && index.isSettledEmpty(id) && !drawn;
}

/**
 * @description Lists the store targets to refresh for the waiting cells.
 * @param waiting The waiting cells by view key.
 * @returns One target per waiting cell that has a message ID.
 */
export function retryTargets(
	waiting: Map<string, WaitingTarget>,
): { id: string; channelId?: string }[] {
	return [...waiting.values()].flatMap(({ id, channelId }) => (id ? [{ id, channelId }] : []));
}

/**
 * @description Splits the waiting cells into those to render again and those to stop tracking.
 * @param waiting The waiting cells by view key.
 * @param changed The message IDs whose mentions changed.
 * @param exhausted Reports whether a message used up its retries.
 * @returns The keys to reschedule and the keys to drop; the rest keep waiting.
 */
export function planRetries(
	waiting: Map<string, WaitingTarget>,
	changed: Set<string>,
	exhausted: (id: string) => boolean,
): RetryPlan {
	const plan: RetryPlan = { reschedule: [], drop: [] };

	for (const [key, { id }] of waiting) {
		if (id && changed.has(id)) plan.reschedule.push(key);
		else if (!id || exhausted(id)) plan.drop.push(key);
	}

	return plan;
}

/**
 * @description Caches each cell's message info until the cell shows a different view model.
 * @param viewModelOf Reads a cell's view model identity.
 * @param read Reads a cell's message info from native.
 * @returns `get`, `forget` and `clear`.
 */
export function createCellMessages<Cell, Info>(
	viewModelOf: (cell: Cell) => string | undefined,
	read: (cell: Cell) => Promise<Info | undefined>,
) {
	const known = new Map<string, { viewModel: string; info: Info }>();

	return {
		async get(cell: Cell, key: string | undefined): Promise<Info | undefined> {
			const viewModel = key ? viewModelOf(cell) : undefined;
			const cached = key ? known.get(key) : undefined;

			if (cached && viewModel !== undefined && cached.viewModel === viewModel) {
				return cached.info;
			}

			const info = await read(cell);

			if (key && info && viewModel !== undefined) known.set(key, { viewModel, info });

			return info;
		},
		forget: (key: string) => void known.delete(key),
		clear: () => known.clear(),
	};
}
