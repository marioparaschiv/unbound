import type { NativeCancelablePromise, NativeHandle } from '../src/native';

/** One call a plugin made to a fake native bridge, in order. */
export type NativeCall = {
	bridge: 'objc' | 'java' | 'hooks';
	/** The bridge member called, such as `invoke`. */
	method: string;
	/** The class the call reached, or `unknown` when the target is not a registered object. */
	target: string;
	/** The selector (Objective-C) or method or field name (Java), empty when the call has none. */
	name: string;
	args: unknown[];
};

/** The calls plugins made to the fake bridges since the last reset. */
export type NativeCallLog = {
	calls: NativeCall[];
	record: (call: NativeCall) => void;
};

/**
 * @description Creates the list the fake bridges append each call to.
 * @returns The log.
 */
export function createCallLog(): NativeCallLog {
	const calls: NativeCall[] = [];

	return { calls, record: (call) => void calls.push(call) };
}

/**
 * @description Wraps a settled call in the promise the bridge returns, which rejects when the call throws.
 * @param run The call.
 * @returns A promise with a `cancel` that does nothing, since the call has run.
 */
export function settled<T>(run: () => T): NativeCancelablePromise<T> {
	let promise: Promise<T>;

	try {
		promise = Promise.resolve(run());
	} catch (error) {
		promise = Promise.reject(error);
	}

	return Object.assign(promise, { cancel: () => {} });
}

/**
 * @description Gives a bridge the members a test did not fake as functions that throw naming the member, so a plugin reaching one fails loudly.
 * @param name The bridge's name, such as `objc`.
 * @param members The members the kit fakes.
 * @returns The bridge.
 */
export function withMissingMembers<T extends object>(name: string, members: Partial<T>): T {
	// UNKNOWN: the members are a partial bridge; the proxy answers the rest, so it has the whole bridge's shape.
	return new Proxy(members, {
		get(target, key, receiver) {
			if (typeof key !== 'string' || key in target) {
				return Reflect.get(target, key, receiver);
			}

			return () => {
				throw new Error(
					`Failed to call native.${name}.${key}: the test kit does not fake it. Pass your own with startPlugin({ native: { ${name}: { ${key} } } }).`,
				);
			};
		},
	}) as T;
}

/** Any fake object that stands for a native handle. */
export type Brandable = { constructor: { name: string } };

/**
 * @description Types a fake's own object as the opaque handle a native bridge hands out, which has no runtime shape.
 * @template T The handle type.
 * @param value The fake object that stands for the handle.
 * @returns The same object, as a handle.
 */
export function brand<T extends NativeHandle>(value: Brandable): T {
	return value as T;
}
