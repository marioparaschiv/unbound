import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { findVisibleCells } from '@unbound-plugins/shared/native/ios/visible-cells';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';

import { IOSClass } from '~/lib/constants';

/**
 * @description Asks each chat table to size its rows again, so a new row room or inset applies to the rows on screen. One batch without animation, so stopping leaves no frame of tall rows without bubbles.
 * @param objc The Objective-C bridge.
 */
export async function resizeRows(objc: NativeObjCBridge) {
	const tables = new Map<string, NativeObjectHandle>();
	const cells = await findVisibleCells(objc, IOSClass.messageCell);
	const parents = await objc.batch(
		cells.map((cell) => ({ target: cell, selector: 'superview', args: [] })),
	);

	for (const parent of parents) {
		const table = parent as NativeObjectHandle | null;
		const key = table ? viewKey(objc, table) : undefined;

		if (table && key !== undefined) tables.set(key, table);
	}

	if (!tables.size) return;

	const UIView = objc.getClass('UIView')!;

	await objc.batch([
		{ target: UIView, selector: 'setAnimationsEnabled:', args: [false] },
		...[...tables.values()].flatMap((table) => [
			{ target: table, selector: 'beginUpdates', args: [] },
			{ target: table, selector: 'endUpdates', args: [] },
		]),
		{ target: UIView, selector: 'setAnimationsEnabled:', args: [true] },
	]);
}

export default { resizeRows };
