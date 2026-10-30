import type { NativeHandle, NativeObjCBridge } from '@unbound-app/api/native';

/**
 * @description Calls a selector on the main thread, treating a bridge error as no result.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handle The receiver.
 * @param selector The selector to call.
 * @param args The selector's arguments.
 * @returns The selector's result, or `null` when the call failed.
 */
// UNKNOWN: returns whatever the Objective-C method returns; callers narrow it.
export function safeInvoke(
	objc: NativeObjCBridge,
	handle: NativeHandle,
	selector: string,
	...args: unknown[]
): unknown {
	try {
		return objc.invoke(handle, selector, args, { thread: 'main' });
	} catch {
		return null;
	}
}

/**
 * @description Calls a selector without blocking the JS thread, treating a bridge error as no result.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handle The receiver.
 * @param selector The selector to call.
 * @param args The selector's arguments.
 * @returns The selector's result, or `null` when the call failed.
 */
// UNKNOWN: resolves to whatever the Objective-C method returns; callers narrow it.
export async function safeInvokeAsync(
	objc: NativeObjCBridge,
	handle: NativeHandle,
	selector: string,
	...args: unknown[]
): Promise<unknown> {
	try {
		return await objc.invokeAsync(handle, selector, args);
	} catch {
		return null;
	}
}

/**
 * @description Calls a selector on the calling thread, so a native hook never waits on the main thread, treating a bridge error as no result.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handle The receiver.
 * @param selector The selector to call.
 * @param args The selector's arguments.
 * @returns The selector's result, or `null` when the call failed.
 */
// UNKNOWN: returns whatever the Objective-C method returns; callers narrow it.
export function safeCall(
	objc: NativeObjCBridge,
	handle: NativeHandle,
	selector: string,
	...args: unknown[]
): unknown {
	try {
		return objc.call(handle, selector, ...args);
	} catch {
		return null;
	}
}

export default { safeInvoke, safeInvokeAsync, safeCall };
