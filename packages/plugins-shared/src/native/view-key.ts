import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { safeInvoke } from './safe-invoke';

// UNKNOWN: `hash` and `description` come back from the bridge untyped.
function scalar(value: unknown): string | undefined {
	if (typeof value === 'number' || typeof value === 'bigint') {
		return String(value);
	}

	if (typeof value === 'string' && value.length > 0) {
		return value;
	}
}

/**
 * @description Builds a stable key for a native view, since the bridge returns a new handle object on every call.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view or cell.
 * @returns `Class:hash`, else `Class:description`, or `undefined` when the view exposes neither.
 */
export function viewKey(objc: NativeObjCBridge, view: NativeObjectHandle): string | undefined {
	const className = objc.className(view) ?? 'NSObject';
	let hash: unknown;

	// `hash` runs on the calling thread, so a layout hook never waits on the main thread.
	try {
		hash = objc.call(view, 'hash');
	} catch {
		hash = undefined;
	}

	const identity = scalar(hash) ?? scalar(safeInvoke(objc, view, 'description'));

	return identity === undefined ? undefined : `${className}:${identity}`;
}

export default viewKey;
