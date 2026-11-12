import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

/**
 * @description Reads the id of the message a cell's view model shows, on the UI thread.
 * @param objc The Objective-C bridge.
 * @param viewModel The cell's view model, or `null`.
 * @returns The message id, or `undefined` without one.
 */
export function messageIdOfViewModel(
	objc: NativeObjCBridge,
	viewModel: NativeObjectHandle | null,
): string | undefined {
	'worklet';
	const message = viewModel
		? (objc.call(viewModel, 'message') as NativeObjectHandle | null)
		: null;
	const identifier = message ? objc.call(message, 'id') : null;

	if (typeof identifier === 'string') {
		return identifier;
	}

	if (identifier && typeof identifier === 'object') {
		const description = objc.call(identifier as NativeObjectHandle, 'description');

		return typeof description === 'string' ? description : undefined;
	}

	return undefined;
}

/**
 * @description Reads the id of the message a cell shows now, on the UI thread.
 * @param objc The Objective-C bridge.
 * @param cell The message cell.
 * @returns The message id, or `undefined` without one.
 */
export function messageIdOf(objc: NativeObjCBridge, cell: NativeObjectHandle): string | undefined {
	'worklet';

	return messageIdOfViewModel(objc, objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null);
}

export default { messageIdOf, messageIdOfViewModel };
