import type {
	NativeHookToken,
	NativeHookHandlers,
	NativeObjCBridge,
	NativeObjectHandle,
	NativeViewSnapshotNode,
} from '@unbound-app/api/native';
import { readNativeMessageInfo } from '@unbound-plugins/shared/native/message-info';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import { viewKey } from '@unbound-plugins/shared/native/view-key';

import { createIcon, describeIcon, fillKey, recolorIcon } from '~/native/icon';
import { installLayout, restoreLayout, type Layout } from '~/native/layout';
import type { TooltipController } from '~/native/tooltip';
import type { LatencyRecord, LatencyRecords } from '~/records';
import { findUsernameHeader } from '~/username-header';
import { CELL_SNAPSHOT } from '~/constants';
import { subscribeTheme } from '~/theme';

type LatencyView = {
	cellKey: string;
	messageId: string;
	icon: NativeObjectHandle;
	layout: Layout;
	fillKey: string;
	tooltip: string;
};

export type MessageCells = {
	/** Installs the cell hooks and returns the function that removes them and starts restoring every header. */
	hook(): () => void;
	/** Resolves once the headers are restored after the hooks were removed. */
	settled(): Promise<void>;
};

type Cell = {
	// Bumped on every schedule, so a render that resolves after reuse or dispose can tell it is stale.
	revision: number;
	rendering: boolean;
	messageId?: string;
	view?: LatencyView;
};

/**
 * @description Draws the indicator into Discord's native message cells as they appear and are reused, and keeps it in step with the records and the theme.
 * @param objc The Objective-C bridge from `context.native`.
 * @param records The latency cache to draw from.
 * @param tooltips The tooltip shown when an indicator is tapped, or `null` when unavailable. The cells own and dispose it.
 * @returns The cells feature, whose `hook` throws when a hook cannot be installed.
 */
export function createMessageCells(
	objc: NativeObjCBridge,
	records: LatencyRecords,
	tooltips: TooltipController | null,
): MessageCells {
	const cells = new Map<string, Cell>();
	const cellsByMessageId = new Map<string, NativeObjectHandle>();
	// Mutations of one cell run one at a time, in order.
	const queues = new Map<string, Promise<void>>();
	const tasks = new Set<Promise<void>>();
	let nextRevision = 0;
	let disposed = false;
	let teardown = Promise.resolve();

	function isCurrent(view: LatencyView) {
		return !disposed && cells.get(view.cellKey)?.view === view;
	}

	function enqueue(key: string, work: () => Promise<void>): Promise<void> {
		const task = (queues.get(key) ?? Promise.resolve())
			.then(work)
			.catch(() => undefined)
			.finally(() => {
				tasks.delete(task);

				if (queues.get(key) === task) queues.delete(key);
			});

		queues.set(key, task);
		tasks.add(task);

		return task;
	}

	async function removeView(view: LatencyView) {
		tooltips?.dismissFor(view.cellKey);

		const cell = cells.get(view.cellKey);

		if (cell?.view === view) cell.view = undefined;

		await restoreLayout(objc, view.layout);
		await safeInvokeAsync(objc, view.icon, 'removeFromSuperview');
	}

	async function updateView(view: LatencyView, record: LatencyRecord) {
		const fill = fillKey(record.details.fill);

		if (view.fillKey !== fill) {
			if (!(await recolorIcon(objc, view.icon, record.details.fill, () => isCurrent(view)))) {
				return;
			}

			view.fillKey = fill;
		}

		if (view.tooltip !== record.tooltip) {
			await describeIcon(objc, view.icon, record);
			view.tooltip = record.tooltip;
		}
	}

	async function addView(
		key: string,
		messageId: string,
		record: LatencyRecord,
		nodes: NativeViewSnapshotNode[],
		isFresh: () => boolean,
	) {
		const match = findUsernameHeader(nodes, record.username);

		if (!match) return;

		const icon = await createIcon(objc, record);

		if (!icon || !viewKey(objc, icon) || !isFresh()) return;

		const layout = await installLayout(objc, icon, match.label, match.header);
		const cell = cells.get(key);

		if (!cell || !isFresh()) {
			await restoreLayout(objc, layout);
			await safeInvokeAsync(objc, icon, 'removeFromSuperview');

			return;
		}

		cell.view = {
			cellKey: key,
			messageId,
			icon,
			layout,
			fillKey: fillKey(record.details.fill),
			tooltip: record.tooltip,
		};
		await safeInvokeAsync(objc, match.header, 'setNeedsLayout');
		await safeInvokeAsync(objc, match.header, 'layoutIfNeeded');
	}

	async function render(handle: NativeObjectHandle, key: string, revision: number) {
		const isFresh = () => !disposed && cells.get(key)?.revision === revision;
		const nodes = await objc.snapshot(handle, CELL_SNAPSHOT);

		if (!isFresh()) return;

		if (!nodes[0]?.visible) {
			disposeCell(handle);

			return;
		}

		const messageId = (await readNativeMessageInfo(handle, objc))?.messageId;

		if (!isFresh()) return;

		await enqueue(key, async () => {
			const cell = cells.get(key);

			if (!cell || !isFresh()) return;

			if (cell.messageId && cell.messageId !== messageId) {
				cellsByMessageId.delete(cell.messageId);
				cell.messageId = undefined;
			}

			if (!messageId) return;

			cell.messageId = messageId;
			cellsByMessageId.set(messageId, handle);

			if (cell.view && cell.view.messageId !== messageId) await removeView(cell.view);

			if (!isFresh()) return;

			const record = records.get(messageId);

			if (!record) {
				if (cell.view) await removeView(cell.view);

				return;
			}

			if (cell.view) {
				await updateView(cell.view, record);

				return;
			}

			await addView(key, messageId, record, nodes, isFresh);
		});
	}

	function schedule(handle: NativeObjectHandle) {
		const key = viewKey(objc, handle);

		if (!key || cells.get(key)?.rendering) return;

		const revision = ++nextRevision;
		const cell = cells.get(key) ?? { revision, rendering: true };

		cell.revision = revision;
		cell.rendering = true;
		cells.set(key, cell);

		// Deferred so the native lifecycle call that triggered it returns first.
		setTimeout(() => {
			if (disposed || cells.get(key) !== cell) return;

			void render(handle, key, revision)
				.catch(() => {
					if (!disposed && cells.get(key)?.revision === revision) disposeCell(handle);
				})
				.finally(() => {
					if (cells.get(key)?.revision === revision) cell.rendering = false;
				});
		}, 0);
	}

	function disposeCell(handle: NativeObjectHandle) {
		const key = viewKey(objc, handle);
		const cell = key ? cells.get(key) : undefined;

		if (!key || !cell) return;

		const { view, messageId } = cell;

		cells.delete(key);

		if (view) void enqueue(key, () => removeView(view));

		if (messageId && cellsByMessageId.get(messageId) === handle) {
			cellsByMessageId.delete(messageId);
		}
	}

	function refresh(messageId: string) {
		const handle = cellsByMessageId.get(messageId);

		if (handle) schedule(handle);
	}

	function refreshTheme() {
		for (const { view } of cells.values()) {
			const record = view && records.get(view.messageId);

			if (view && record) void enqueue(view.cellKey, () => updateView(view, record));
		}
	}

	function onIconTap(icon: NativeObjectHandle) {
		const key = viewKey(objc, icon);

		if (!key || !tooltips) return;

		for (const { view } of cells.values()) {
			if (view && viewKey(objc, view.icon) === key) {
				tooltips.show(view, () => isCurrent(view));

				return;
			}
		}
	}

	async function restoreAll() {
		await Promise.all([...tasks]);

		const views = [...cells.values()].flatMap(({ view }) => (view ? [view] : []));

		await Promise.all(views.map(removeView));
		await tooltips?.dispose();
		cells.clear();
		cellsByMessageId.clear();
		queues.clear();
	}

	function hook() {
		const hooks: NativeHookToken[] = [];
		const handlers: [className: string, selector: string, NativeHookHandlers][] = [
			[
				'UIControl',
				'endTrackingWithTouch:withEvent:',
				{ after: ({ self }) => onIconTap(self) },
			],
			['DCDMessageTableViewCell', 'didMoveToWindow', { after: ({ self }) => schedule(self) }],
			[
				'DCDMessageTableViewCell',
				'prepareForReuse',
				{
					after: ({ self }) => {
						disposeCell(self);
						schedule(self);
					},
				},
			],
		];

		try {
			for (const [className, selector, handler] of handlers) {
				hooks.push(objc.hook(className, selector, handler));
			}
		} catch (error) {
			for (const token of hooks) token.remove();

			throw error;
		}

		const unsubscribeRecords = records.subscribe(refresh);
		const unsubscribeTheme = subscribeTheme(refreshTheme);

		return () => {
			for (const token of hooks) token.remove();

			unsubscribeRecords();
			unsubscribeTheme();
			disposed = true;
			teardown = restoreAll();
		};
	}

	return { hook, settled: () => teardown };
}

export default { createMessageCells };
