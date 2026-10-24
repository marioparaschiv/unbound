import { readNativeMessageInfo } from '@unbound-plugins/shared/native/message-info';
import type { NativeHookToken, NativeObjectHandle } from '@unbound-app/api/native';
import viewKey from '@unbound-plugins/shared/native/view-key';

import { embedCell, type CellStatus } from '~/native/embed-cell';
import { CellRetry, INITIAL_SCAN_DELAYS } from '~/constants';
import { teardownSurface } from '~/native/surfaces';
import type { Session } from '~/native/session';
import { linkedTargets } from '~/link-targets';
import { currentChannelId } from '~/channels';
import { MessageStore } from '~/modules';

type Timer = ReturnType<typeof setTimeout>;

/**
 * Where a cell is in its lookup. `pending` is a lookup in flight, `waiting` waits for a linked
 * message to be fetched, `retrying` waits to look again, and `done` has nothing more to do.
 */
type CellPhase = 'pending' | 'waiting' | 'retrying' | 'done';

/** A message cell the plugin has seen, keyed by its `cellKey`. */
export type TrackedCell = {
	cell: NativeObjectHandle;
	phase?: CellPhase;
	version?: number;
	retries: number;
	retryTimer?: Timer;
	waitingFor?: string;
	visibleMessageId?: string;
	labelHooks?: NativeHookToken[];
};

function trackCell(session: Session, key: string, cell: NativeObjectHandle): TrackedCell {
	const tracked = session.cells.get(key) ?? { cell, retries: 0 };

	tracked.cell = cell;
	session.cells.set(key, tracked);

	return tracked;
}

/**
 * @description Removes the label hooks that watch a cell for the text an embed needs.
 * @param tracked The cell.
 */
export function removeLabelHooks(tracked: TrackedCell) {
	for (const hook of tracked.labelHooks ?? []) hook.remove();

	tracked.labelHooks = undefined;
}

// Re-checks the cell whenever one of its labels gets new text, until an embed attaches.
function observeLabels(session: Session, tracked: TrackedCell, labels: NativeObjectHandle[]) {
	const { objc } = session;

	if (tracked.labelHooks) return;

	const hooks: NativeHookToken[] = [];

	for (const label of labels) {
		if (!objc.className(label)?.includes('DCDReusableYYLabel')) continue;

		try {
			hooks.push(
				objc.hook(
					'DCDReusableYYLabel',
					'setAttributedText:',
					{ after: () => refreshCell(session, tracked.cell) },
					{ instance: label },
				),
			);
		} catch {
			// Without the hook this label only lacks the early refresh; retries still run.
		}
	}

	if (hooks.length > 0) tracked.labelHooks = hooks;
}

function clearCell(session: Session, key: string) {
	const tracked = session.cells.get(key);

	if (tracked) {
		session.timers.cancel(tracked.retryTimer);
		removeLabelHooks(tracked);
		session.cells.delete(key);
	}

	const surface = session.surfaces.get(key);

	if (surface) teardownSurface(session, surface, true);
}

function refreshCell(session: Session, cell: NativeObjectHandle) {
	const key = viewKey(session.objc, cell);

	if (!key || session.surfaces.has(key)) return;

	const tracked = session.cells.get(key);

	if (tracked) {
		tracked.retries = 0;
		tracked.waitingFor = undefined;

		if (tracked.phase === 'done' || tracked.phase === 'waiting') tracked.phase = undefined;
	}

	scheduleCell(session, cell);
}

async function lookUpCell(session: Session, cell: NativeObjectHandle, isCurrent: () => boolean) {
	const { objc } = session;
	const info = await readNativeMessageInfo(cell, objc);
	const channelId = info?.channelId ?? currentChannelId();
	const source = info && channelId ? MessageStore.getMessage(channelId, info.messageId) : null;
	const labels =
		source && linkedTargets(source).length > 0
			? await objc.findViews(cell, 'DCDReusableYYLabel', {
					maxDepth: 10,
					maxVisited: 100,
					maxResults: 32,
					stopAtMatch: false,
				})
			: [];

	if (!isCurrent()) return;

	return { info, channelId, labels };
}

async function processCell(
	session: Session,
	key: string,
	cell: NativeObjectHandle,
	isCurrent: () => boolean,
) {
	if (!isCurrent()) return;

	let labels: NativeObjectHandle[] = [];
	let status: CellStatus;

	try {
		const lookup = await lookUpCell(session, cell, isCurrent);

		if (!lookup) return;

		labels = lookup.labels;
		status = await embedCell(session, { key, cell, ...lookup }, isCurrent);
	} catch {
		status = 'done';
	}

	if (!isCurrent()) return;

	const tracked = session.cells.get(key)!;

	if (status === 'embedded') removeLabelHooks(tracked);

	if (status === 'done' || status === 'embedded') {
		tracked.phase = 'done';
		tracked.retries = 0;

		return;
	}

	if (status === 'waiting') {
		tracked.phase = tracked.waitingFor ? 'waiting' : undefined;

		return;
	}

	observeLabels(session, tracked, labels);

	if (++tracked.retries > CellRetry.limit) {
		tracked.phase = 'done';

		return;
	}

	tracked.phase = 'retrying';
	tracked.retryTimer = session.timers.later(() => {
		tracked.retryTimer = undefined;
		tracked.phase = undefined;
		scheduleCell(session, cell);
	}, CellRetry.delay);
}

/**
 * @description Queues a lookup that embeds the linked message into a cell, unless one is in flight or settled.
 * @param session The running session.
 * @param cell The message cell.
 */
export function scheduleCell(session: Session, cell: NativeObjectHandle) {
	const key = viewKey(session.objc, cell);

	if (!key) return;

	const tracked = trackCell(session, key, cell);

	if (session.surfaces.has(key) || tracked.phase) return;

	const version = ++session.nextVersion;

	tracked.phase = 'pending';
	tracked.version = version;

	// A cleared or rescheduled cell gets a new version, which retires this lookup.
	const isCurrent = () => !session.signal.aborted && session.cells.get(key)?.version === version;

	session.timers.later(() => void processCell(session, key, cell, isCurrent));
}

/**
 * @description Re-checks the cells that were waiting for a linked message to be fetched.
 * @param session The running session.
 * @param targetKey The fetched message's key.
 */
export function wakeWaitingCells(session: Session, targetKey: string) {
	for (const tracked of session.cells.values()) {
		if (tracked.waitingFor !== targetKey) continue;

		tracked.waitingFor = undefined;
		tracked.retries = 0;

		if (tracked.phase === 'waiting') tracked.phase = undefined;

		scheduleCell(session, tracked.cell);
	}
}

/**
 * @description Finds the message cells on screen and queues each one, for cells that appeared without a hook firing.
 * @param session The running session.
 */
export async function scanVisibleCells(session: Session) {
	const { objc, signal } = session;
	const application = objc.getClass('UIApplication');

	if (!application) return;

	try {
		const [, windowList, keyWindow] = await objc.batch([
			{ target: application, selector: 'sharedApplication', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'windows', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'keyWindow', args: [] },
		]);

		if (signal.aborted) return;

		const windows = keyWindow
			? [keyWindow as NativeObjectHandle]
			: Array.isArray(windowList)
				? (windowList as NativeObjectHandle[])
				: (objc.array(windowList as NativeObjectHandle) as NativeObjectHandle[]);

		for (const window of windows) {
			const cells = await objc.findViews(window, 'DCDMessageTableViewCell', {
				maxDepth: 40,
				maxVisited: 800,
				maxResults: 256,
				attachedOnly: true,
				stopAtMatch: true,
			});

			if (signal.aborted) return;

			for (const cell of cells) {
				const key = viewKey(objc, cell);
				const info = await readNativeMessageInfo(cell, objc);

				if (signal.aborted) return;
				if (!key || !info) continue;

				const known = session.cells.get(key);
				const previousId = known?.visibleMessageId ?? session.surfaces.get(key)?.messageId;

				if (previousId && previousId !== info.messageId) {
					clearCell(session, key);
				} else if (!previousId && known?.phase === 'done') {
					known.phase = undefined;
				}

				trackCell(session, key, cell).visibleMessageId = info.messageId;
				scheduleCell(session, cell);
			}
		}
	} catch {
		// The window hierarchy changed mid-scan; the cell hooks and the next scan cover it.
	}
}

/**
 * @description Hooks message cells as they appear and get reused, and scans the cells already on screen.
 * @param session The running session.
 * @returns A function that removes the hooks.
 */
export function hookMessageCells(session: Session): () => void {
	const { objc, signal } = session;
	const hooks = [
		objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
			after: ({ self }) => {
				void objc
					.invokeAsync(self, 'window', [])
					.then((window) => {
						const key = viewKey(objc, self);

						if (signal.aborted || !key) return;

						if (window) {
							scheduleCell(session, self);
						} else {
							clearCell(session, key);
						}
					})
					.catch(() => undefined);
			},
		}),
		objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
			after: ({ self }) => {
				const key = viewKey(objc, self);

				if (!key) return;

				clearCell(session, key);
				session.timers.later(() => scheduleCell(session, self));
			},
		}),
	];

	for (const delay of INITIAL_SCAN_DELAYS) {
		session.timers.later(() => void scanVisibleCells(session), delay);
	}

	return () => {
		for (const hook of hooks) hook.remove();
	};
}
