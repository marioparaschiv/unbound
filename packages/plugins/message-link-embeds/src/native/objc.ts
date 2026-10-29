import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';

import { availableMessageWidthFromNative } from '~/surface-layout';

export type LabelText = {
	attributedText: NativeObjectHandle;
	text: string;
};

/**
 * @description Reads a native value as a string, through `description` when it is an object.
 * @param objc The Objective-C bridge.
 * @param value A string or an object handle.
 * @returns The string, or `undefined` when there is none.
 */
export function nativeString(objc: NativeObjCBridge, value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (!value || typeof value !== 'object') return;

	const handle = value as NativeObjectHandle;

	if (!objc.respondsTo(handle, 'description')) return;

	const description = safeInvoke(objc, handle, 'description');

	return typeof description === 'string' ? description : undefined;
}

/**
 * @description Builds a `CGRect` at the origin.
 * @param objc The Objective-C bridge.
 * @param width The rectangle's width.
 * @param height The rectangle's height.
 * @returns The struct.
 */
export function nativeFrame(objc: NativeObjCBridge, width: number, height: number) {
	return objc.struct('CGRect', { origin: { x: 0, y: 0 }, size: { width, height } });
}

/**
 * @description Reads a label's attributed text and its plain string in one batch.
 * @param objc The Objective-C bridge.
 * @param label The label.
 * @returns Both texts, or `undefined` when the label has none or the read failed.
 */
export async function readLabelText(
	objc: NativeObjCBridge,
	label: NativeObjectHandle,
): Promise<LabelText | undefined> {
	try {
		const [attributedText, text] = await objc.batch([
			{ target: label, selector: 'attributedText', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'string', args: [] },
		]);

		if (!attributedText || typeof text !== 'string') return;

		return { attributedText: attributedText as NativeObjectHandle, text };
	} catch {
		return;
	}
}

/**
 * @description Finds the table view that holds a cell.
 * @param objc The Objective-C bridge.
 * @param cell The cell.
 * @returns The table, or `null` when the cell is not in one.
 */
export async function findTable(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
): Promise<NativeObjectHandle | null> {
	const tables = await objc.findViews(cell, 'UITableView', {
		direction: 'ancestors',
		maxDepth: 14,
		maxResults: 1,
		stopAtMatch: true,
	});

	return (
		tables.find(
			(view) => objc.respondsTo(view, 'beginUpdates') && objc.respondsTo(view, 'endUpdates'),
		) ?? null
	);
}

/**
 * @description Measures how wide an embed under a message label can be.
 * @param objc The Objective-C bridge.
 * @param cell The message's cell.
 * @param label The message's text label.
 * @returns The available width in points.
 */
export async function availableMessageWidth(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
	label: NativeObjectHandle,
): Promise<number> {
	const values = await objc.batch([
		{ target: label, selector: 'bounds', args: [] },
		{ target: label, selector: 'convertRect:toView:', args: [{ $nativeBatchResult: 0 }, cell] },
		{ target: cell, selector: 'bounds', args: [] },
	]);

	return availableMessageWidthFromNative(values[1], values[2]);
}
