import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

const STANDALONE_HOST = 'DCDMessageView';

/**
 * @description Tells whether a message cell is drawn on its own, as in pinned messages and in-app notifications, rather than as a row of the chat.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 * @returns Whether the cell's parent is a standalone message view.
 */
export function isStandaloneCell(objc: NativeObjCBridge, cell: NativeObjectHandle): boolean {
	'worklet';
	const parent = objc.invoke(cell, 'superview', []) as NativeObjectHandle | null;

	return Boolean(parent) && objc.className(parent!) === STANDALONE_HOST;
}

export default isStandaloneCell;
