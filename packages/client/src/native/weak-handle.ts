import type {
	NativeJavaBridge,
	NativeJavaHandleValue,
	NativeJavaReference,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/types/native';

/** A reference that does not keep its native object alive; `deref` reads `null` once the object is gone. */
export type NativeWeakHandle<T> = {
	deref(): T | null;
};

const SLOT = 'object';

function isHandleValue(value: unknown): value is NativeJavaHandleValue {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { type?: unknown }).type === 'handle'
	);
}

/**
 * @description Holds an Objective-C object weakly, through a `strongToWeakObjectsMapTable`, so caching a view or
 * controller does not keep it alive after Discord releases it.
 * @param objc The plugin's Objective-C bridge.
 * @param handle The object to hold.
 * @returns A weak handle whose `deref` gives the object while it lives, then `null`.
 */
export function weakObjC(
	objc: Pick<NativeObjCBridge, 'getClass' | 'call'>,
	handle: NativeObjectHandle,
): NativeWeakHandle<NativeObjectHandle> {
	const table = objc.call(objc.getClass('NSMapTable')!, 'strongToWeakObjectsMapTable');

	objc.call(table as NativeObjectHandle, 'setObject:forKey:', handle, SLOT);

	return {
		deref: () =>
			(objc.call(table as NativeObjectHandle, 'objectForKey:', SLOT) as
				| NativeObjectHandle
				| null
				| undefined) ?? null,
	};
}

/**
 * @description Holds a Java object weakly, through a `java.lang.ref.WeakReference`, so caching a view does not keep
 * it alive after Discord drops it.
 * @param java The plugin's Java bridge.
 * @param handle The object to hold.
 * @returns A weak handle whose `deref` gives the object while it lives, then `null`.
 */
export function weakJava(
	java: Pick<NativeJavaBridge, 'construct' | 'invoke'>,
	handle: NativeJavaReference,
): NativeWeakHandle<NativeJavaHandleValue> {
	const reference = java.construct('java.lang.ref.WeakReference', [handle]);

	return {
		deref: () => {
			const value: unknown = java.invoke(reference, 'get');

			return isHandleValue(value) ? value : null;
		},
	};
}

export default { weakObjC, weakJava };
