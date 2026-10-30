import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { parseRect, toRect } from '@unbound-plugins/shared/native/rect';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';
import viewKey from '@unbound-plugins/shared/native/view-key';

import { framesMatch, type Frame } from '~/layout';

export type Size = {
	height: number;
	width: number;
};

let unkeyed = 0;

// UNKNOWN: selectors return untyped values; this reads a number from one.
function toNumber(value: unknown): number | undefined {
	if (value === null || value === undefined) return;

	const number = Number(value);

	return Number.isFinite(number) ? number : undefined;
}

function isHandle(value: unknown): value is NativeObjectHandle {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Builds a stable identity for a native object, so it can key a map across bridge handles.
 * @param objc The Objective-C bridge.
 * @param handle The object.
 * @returns Its view key, or a key of its own when it has none, so it never shares another view's state.
 */
export function key(objc: NativeObjCBridge, handle: NativeObjectHandle): string {
	return viewKey(objc, handle) ?? `native:${++unkeyed}`;
}

/**
 * @description Reads an `NSArray` of objects.
 * @param objc The Objective-C bridge.
 * @param value The array, as a selector returned it.
 * @returns Its object elements, or `[]` when it is not an array.
 */
// UNKNOWN: selectors return untyped values.
export function toHandles(objc: NativeObjCBridge, value: unknown): NativeObjectHandle[] {
	if (Array.isArray(value)) return value;

	if (!isHandle(value)) return [];

	try {
		return objc.array(value).filter(isHandle);
	} catch {
		return [];
	}
}

/**
 * @description Reads a view's frame.
 * @param objc The Objective-C bridge.
 * @param view The view.
 * @returns Its frame, or `undefined` when it could not be read.
 */
export function frameOf(objc: NativeObjCBridge, view: NativeObjectHandle): Frame | undefined {
	return parseRect(safeInvoke(objc, view, 'frame'));
}

/**
 * @description Moves or resizes a view, skipping the call when it is already there.
 * @param objc The Objective-C bridge.
 * @param view The view.
 * @param frame Its new frame.
 */
export function setFrame(objc: NativeObjCBridge, view: NativeObjectHandle, frame: Frame): void {
	if (framesMatch(frameOf(objc, view), frame)) return;

	safeInvoke(objc, view, 'setFrame:', toRect(objc, frame));
}

/**
 * @description Sets a scroll view's content size.
 * @param objc The Objective-C bridge.
 * @param view The scroll view.
 * @param size Its new content size.
 */
export function setContentSize(objc: NativeObjCBridge, view: NativeObjectHandle, size: Size): void {
	safeInvoke(objc, view, 'setContentSize:', objc.struct('CGSize', size));
}

/**
 * @description Finds the nearest view, itself included, whose class name contains `className`.
 * @param objc The Objective-C bridge.
 * @param view The view to start from.
 * @param className Part of the class name to match.
 * @returns The ancestor within 12 levels, or `null`.
 */
export function ancestorOfClass(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	className: string,
): NativeObjectHandle | null {
	let current: NativeObjectHandle | null = view;

	for (let depth = 0; current && depth < 12; depth++) {
		if (objc.className(current)?.includes(className)) return current;

		current = safeInvoke(objc, current, 'superview') as NativeObjectHandle | null;
	}

	return null;
}

/**
 * @description Finds the reaction pill's view inside a reaction collection cell.
 * @param objc The Objective-C bridge.
 * @param cell The collection cell.
 * @returns The first `ReactionView` within 5 levels and 40 views, breadth first, or `null`.
 */
export function reactionViewOf(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
): NativeObjectHandle | null {
	const queue = [{ depth: 0, view: cell }];

	for (let visited = 0; visited < 40; visited++) {
		const node = queue.shift();

		if (!node) return null;

		if (objc.className(node.view)?.includes('ReactionView')) return node.view;

		if (node.depth >= 5) {
			continue;
		}

		for (const child of toHandles(objc, safeInvoke(objc, node.view, 'subviews'))) {
			queue.push({ depth: node.depth + 1, view: child });
		}
	}

	return null;
}

/**
 * @description Counts a collection view's sections.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @returns The section count, `1` when it could not be read.
 */
export function sectionCount(objc: NativeObjCBridge, collection: NativeObjectHandle): number {
	return toNumber(safeInvoke(objc, collection, 'numberOfSections')) ?? 1;
}

/**
 * @description Counts the items in one section of a collection view.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @param section The section.
 * @returns The item count.
 */
export function sectionItemCount(
	objc: NativeObjCBridge,
	collection: NativeObjectHandle,
	section: number,
): number {
	return toNumber(safeInvoke(objc, collection, 'numberOfItemsInSection:', section)) ?? 0;
}

/**
 * @description Counts the items across a collection view's sections.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @returns The item count.
 */
export function itemCount(objc: NativeObjCBridge, collection: NativeObjectHandle): number {
	const sections = sectionCount(objc, collection);

	let count = 0;

	for (let section = 0; section < sections; section++) {
		count += sectionItemCount(objc, collection, section);
	}

	return count;
}

/**
 * @description Finds which item a collection cell shows.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @param cell One of its cells.
 * @returns The item index, or `undefined` when the cell is not in the collection.
 */
export function itemOfCell(
	objc: NativeObjCBridge,
	collection: NativeObjectHandle,
	cell: NativeObjectHandle,
): number | undefined {
	const indexPath = safeInvoke(
		objc,
		collection,
		'indexPathForCell:',
		cell,
	) as NativeObjectHandle | null;

	if (!indexPath) return;

	const item =
		toNumber(safeInvoke(objc, indexPath, 'item')) ??
		toNumber(safeInvoke(objc, indexPath, 'row'));

	return item === undefined ? undefined : Math.floor(item);
}
