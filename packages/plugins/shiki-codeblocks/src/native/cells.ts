import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { readRect } from '@unbound-plugins/shared/native/rect';

import type { NativeUI } from './ui';

export type MessageIdentity = {
	messageId: string;
	/** The message's own channel, which differs from the visible one for linked messages. */
	sourceChannelId?: string;
};

export type RowGeometry = {
	cellHeight: number;
	contentHeight: number;
	labelBottom: number;
};

function findAncestor(
	ui: NativeUI,
	view: NativeObjectHandle,
	matches: (candidate: NativeObjectHandle) => boolean,
): NativeObjectHandle | null {
	let current: NativeObjectHandle | null = view;

	for (let depth = 0; depth < 14 && current; depth++) {
		if (matches(current)) return current;

		current = ui.view(current, 'superview');
	}

	return null;
}

/**
 * @description Finds the message cell that contains a label.
 * @param ui The native helpers.
 * @param label The message label.
 * @returns The `DCDMessageTableViewCell`, or `null` when the label is not in one.
 */
export function cellForLabel(ui: NativeUI, label: NativeObjectHandle): NativeObjectHandle | null {
	return findAncestor(ui, label, (view) =>
		(ui.objc.className(view) ?? '').includes('DCDMessageTableViewCell'),
	);
}

/**
 * @description Finds the table view that lays out a message cell.
 * @param ui The native helpers.
 * @param cell The message cell.
 * @returns The nearest ancestor that supports `beginUpdates`/`endUpdates`.
 */
export function tableForCell(ui: NativeUI, cell: NativeObjectHandle): NativeObjectHandle | null {
	return findAncestor(
		ui,
		cell,
		(view) =>
			ui.objc.respondsTo(view, 'beginUpdates') && ui.objc.respondsTo(view, 'endUpdates'),
	);
}

/**
 * @description Reads which message a cell shows from its view model.
 * @param ui The native helpers.
 * @param cell The message cell.
 * @returns The message ID and its channel, or `undefined` when the cell has no message.
 */
export function messageIdentity(
	ui: NativeUI,
	cell: NativeObjectHandle,
): MessageIdentity | undefined {
	try {
		const viewModel = ui.objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;

		if (!viewModel || !ui.objc.respondsTo(viewModel, 'message')) return;

		const message = ui.view(viewModel, 'message');
		const messageId = message ? ui.string(ui.call(message, 'id')) : undefined;

		if (!message || !messageId) return;

		return { messageId, sourceChannelId: ui.string(ui.call(message, 'channelID')) };
	} catch {
		return;
	}
}

/**
 * @description Measures how wide a code card in a label can be.
 * @param ui The native helpers.
 * @param cell The message cell.
 * @param label The message label.
 * @returns The label's width once laid out, otherwise the room between its left edge and the cell's, or `0` when under 80 points.
 */
export function measureCardWidth(
	ui: NativeUI,
	cell: NativeObjectHandle,
	label: NativeObjectHandle,
): number {
	const labelWidth = ui.frameOf(label).width;

	if (labelWidth > 80) return labelWidth;

	let current = label;
	let left = 0;

	for (let depth = 0; depth < 14; depth++) {
		left += ui.frameOf(current).x;

		const parent = ui.view(current, 'superview');

		if (!parent || parent === cell) break;

		current = parent;
	}

	const available = ui.frameOf(cell).width - left - 12;

	return Number.isFinite(available) && available > 80 ? available : 0;
}

/**
 * @description Measures a message row after layout, in one round trip to the main thread.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 * @param label The message label.
 * @returns The row's heights, or `null` when the label has left the cell.
 */
export async function measureRow(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	label: NativeObjectHandle,
): Promise<RowGeometry | null> {
	const values = await objc.batch([
		{ target: label, selector: 'isDescendantOfView:', args: [cell] },
		{ target: label, selector: 'layoutIfNeeded', args: [] },
		{ target: cell, selector: 'layoutIfNeeded', args: [] },
		{ target: cell, selector: 'contentView', args: [] },
		{ target: cell, selector: 'frame', args: [] },
		{ target: { $nativeBatchResult: 3 }, selector: 'frame', args: [] },
		{ target: label, selector: 'bounds', args: [] },
		{ target: label, selector: 'convertRect:toView:', args: [{ $nativeBatchResult: 6 }, cell] },
	]);

	if (!values[0]) return null;

	const labelFrame = readRect(values[7]);

	return {
		cellHeight: readRect(values[4]).height,
		contentHeight: readRect(values[5]).height,
		labelBottom: labelFrame.y + labelFrame.height,
	};
}

export default { cellForLabel, tableForCell, messageIdentity, measureCardWidth, measureRow };
