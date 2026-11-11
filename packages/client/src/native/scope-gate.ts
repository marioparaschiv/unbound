import type {
	NativeCancelablePromise,
	NativePluginCapability,
	NativePluginMethod,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_METHOD_CAPABILITIES } from '@unbound-app/types/native';

import {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	NativePluginUnavailableError,
} from '~/native/errors';
import type { AddonAttribution } from '~/addons/crash-guard';

const UNAVAILABLE_BRIDGE = 'The native plugin bridge is unavailable.';

/** A bridge method as a scope hands it out: never missing, since a missing one throws when called. */
export type BridgeMethod<T, K extends keyof T> = Exclude<T[K], undefined>;

/** Whether a plugin scope has been disposed, read by every scoped call. */
export type ScopeLifecycle = { disposed: boolean };

type Track = <T>(pending: NativeCancelablePromise<T>) => NativeCancelablePromise<T>;

type ScopeGateOptions = {
	capabilities: readonly NativePluginCapability[];
	attribute?: AddonAttribution;
	lifecycle: ScopeLifecycle;
	track: Track;
};

/** The wrappers a plugin scope gates its native calls with. */
export type ScopeGate = {
	requireGranted: (path: NativePluginMethod) => void;
	scopeMethod: <A extends unknown[], R>(
		method: (...args: A) => R,
		path: NativePluginMethod,
	) => (...args: A) => R;
	scopeAsyncMethod: <A extends unknown[], R>(
		method: ((...args: A) => NativeCancelablePromise<R>) | undefined,
		path: NativePluginMethod,
		unavailableMessage: string,
	) => (...args: A) => NativeCancelablePromise<R>;
	scopeBridgeMethod: <T extends object, K extends keyof T>(
		source: T,
		name: K,
		path: NativePluginMethod,
		unavailableMessage?: string,
	) => BridgeMethod<T, K>;
	scopeBridgeAsyncMethod: <T extends object, K extends keyof T>(
		source: T,
		name: K,
		path: NativePluginMethod,
		unavailableMessage?: string,
	) => BridgeMethod<T, K>;
};

type AnyMethod = (...args: never[]) => void;

function methodOf<T extends object, K extends keyof T>(source: T, name: K): AnyMethod | undefined {
	const method = source[name];

	return typeof method === 'function' ? (method as AnyMethod) : undefined;
}

/**
 * @description Builds the one wrapper each scoped native call runs through: it checks the scope is live, that the
 * capability was declared when the scope was built and that the loader has the method, then calls it with the
 * addon marked active for crash attribution.
 * @param options The scope's declared capabilities, attribution, lifecycle and pending-call tracker.
 * @returns The scope's wrappers.
 */
export function createScopeGate({
	capabilities,
	attribute,
	lifecycle,
	track,
}: ScopeGateOptions): ScopeGate {
	const granted = new Set(capabilities);
	const activity = attribute?.activity;

	function requireGranted(path: NativePluginMethod): void {
		const capability = NATIVE_PLUGIN_METHOD_CAPABILITIES[path];

		if (!granted.has(capability)) {
			throw new NativePluginCapabilityError(capability);
		}
	}

	function gate<S, A extends unknown[], R>(
		method: ((...args: A) => R) | undefined,
		path: NativePluginMethod,
		unavailableMessage: string,
		receiver: S,
		tracked: boolean,
	): (...args: A) => R {
		const capability = NATIVE_PLUGIN_METHOD_CAPABILITIES[path];
		const allowed = granted.has(capability);
		const call = method && attribute && !activity ? attribute(method.bind(receiver)) : method;
		const target = call === method ? receiver : undefined;

		return (...args: A) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			if (!allowed) {
				throw new NativePluginCapabilityError(capability);
			}

			if (!call) {
				throw new NativePluginUnavailableError(unavailableMessage);
			}

			let result: R;

			if (activity) {
				const { cell, slot } = activity;
				const previous = cell[0];

				cell[0] = slot;

				try {
					result = Reflect.apply(call, target, args);
				} finally {
					cell[0] = previous;
				}
			} else {
				result = Reflect.apply(call, target, args);
			}

			return tracked ? (track(result as NativeCancelablePromise<unknown>) as R) : result;
		};
	}

	return {
		requireGranted,
		scopeMethod: (method, path) => gate(method, path, UNAVAILABLE_BRIDGE, undefined, false),
		scopeAsyncMethod: (method, path, unavailableMessage) =>
			gate(method, path, unavailableMessage, undefined, true),
		scopeBridgeMethod: (source, name, path, unavailableMessage = UNAVAILABLE_BRIDGE) =>
			gate(methodOf(source, name), path, unavailableMessage, source, false) as BridgeMethod<
				typeof source,
				typeof name
			>,
		scopeBridgeAsyncMethod: (source, name, path, unavailableMessage = UNAVAILABLE_BRIDGE) =>
			gate(methodOf(source, name), path, unavailableMessage, source, true) as BridgeMethod<
				typeof source,
				typeof name
			>,
	};
}
