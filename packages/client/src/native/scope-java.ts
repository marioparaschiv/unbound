import type {
	NativeCancelablePromise,
	NativeJavaBridge,
	NativeJavaCallPlan,
	NativeJavaHandle,
	NativeJavaReference,
	NativePluginMethod,
} from '@unbound-app/types';

import { NativePluginUnavailableError } from '~/native/errors';

const JAVA_HANDLE_PRUNE_SIZE = 1_024;
const javaHandleHolders = new WeakMap<NativeJavaReference, number>();

function holdJavaHandle(handle: NativeJavaReference): void {
	javaHandleHolders.set(handle, (javaHandleHolders.get(handle) ?? 0) + 1);
}

function dropJavaHandle(handle: NativeJavaReference): boolean {
	const holders = (javaHandleHolders.get(handle) ?? 1) - 1;

	if (holders > 0) {
		javaHandleHolders.set(handle, holders);

		return false;
	}

	javaHandleHolders.delete(handle);

	return true;
}

type ScopeMethod = <A extends unknown[], R>(
	method: (...args: A) => R,
	path: NativePluginMethod,
) => (...args: A) => R;

type ScopeOptionalMethod = <A extends unknown[], R>(
	method: ((...args: A) => R) | undefined,
	path: NativePluginMethod,
	unavailableMessage: string,
) => (...args: A) => R;

type ScopeAsyncMethod = <A extends unknown[], R>(
	method: ((...args: A) => NativeCancelablePromise<R>) | undefined,
	path: NativePluginMethod,
	unavailableMessage: string,
) => (...args: A) => NativeCancelablePromise<R>;

type CreateScopedJavaBridgeOptions = {
	bridge: NativeJavaBridge;
	scopeMethod: ScopeMethod;
	scopeOptionalMethod: ScopeOptionalMethod;
	scopeAsyncMethod: ScopeAsyncMethod;
};

type ScopedJavaBridge = {
	bridge: NativeJavaBridge;
	dispose: () => void;
};

/**
 * @description Builds a plugin's Java bridge, which tracks the handles and call plans it hands out so they are released when the plugin stops.
 * @param options The loader's Java bridge and the scope's method wrappers.
 * @returns The scoped bridge and its `dispose`.
 */
export function createScopedJavaBridge({
	bridge,
	scopeMethod,
	scopeOptionalMethod,
	scopeAsyncMethod,
}: CreateScopedJavaBridgeOptions): ScopedJavaBridge {
	const plans = new Set<NativeJavaCallPlan>();
	const handles = new Set<WeakRef<NativeJavaReference>>();

	function holdsHandle(handle: NativeJavaReference): boolean {
		for (const tracked of handles) {
			if (tracked.deref() === handle) {
				return true;
			}
		}

		return false;
	}

	function trackHandle<T extends NativeJavaHandle>(handle: T): T {
		if (handles.size >= JAVA_HANDLE_PRUNE_SIZE) {
			for (const tracked of handles) {
				if (!tracked.deref()) {
					handles.delete(tracked);
				}
			}
		}

		if (!holdsHandle(handle)) {
			handles.add(new WeakRef(handle));
			holdJavaHandle(handle);
		}

		return handle;
	}

	function untrackHandle(handle: NativeJavaReference): boolean {
		let held = false;

		for (const tracked of handles) {
			if (tracked.deref() === handle) {
				handles.delete(tracked);
				held = true;
			}
		}

		return held;
	}

	const scopedBridge: NativeJavaBridge = {
		getClass: (name) =>
			trackHandle(scopeMethod(bridge.getClass.bind(bridge), 'java.getClass')(name)),
		className: scopeMethod(bridge.className.bind(bridge), 'java.className'),
		describe: scopeMethod(bridge.describe.bind(bridge), 'java.describe'),
		construct: (name, args) =>
			trackHandle(
				scopeMethod(bridge.construct.bind(bridge), 'java.construct')(name, args ?? []),
			),
		respondsTo: (handle, name, args) =>
			scopeMethod(bridge.respondsTo.bind(bridge), 'java.respondsTo')(
				handle,
				name,
				args ?? [],
			),
		invoke: (handle, name, args) =>
			scopeMethod(bridge.invoke.bind(bridge), 'java.invoke')(handle, name, args ?? []),
		prepare: (target, name, parameterTypes) => {
			const plan = trackHandle(
				scopeOptionalMethod(
					bridge.prepare?.bind(bridge),
					'java.prepare',
					'Prepared Java calls are unavailable.',
				)(target, name, parameterTypes),
			);

			plans.add(plan);

			return plan;
		},
		invokePrepared: (plan, target, args) => {
			if (!plans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Java call plan is outside this plugin scope.',
				);
			}

			return scopeOptionalMethod(
				bridge.invokePrepared?.bind(bridge),
				'java.invokePrepared',
				'Prepared Java calls are unavailable.',
			)(plan, target, args ?? []);
		},
		invokePreparedAsync: (plan, target, args) => {
			if (!plans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Java call plan is outside this plugin scope.',
				);
			}

			return scopeAsyncMethod(
				bridge.invokePreparedAsync?.bind(bridge),
				'java.invokePreparedAsync',
				'Prepared asynchronous Java invocation is unavailable.',
			)(plan, target, args ?? []);
		},
		disposePlan: (plan) => {
			if (!plans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Java call plan is outside this plugin scope.',
				);
			}

			scopeOptionalMethod(
				bridge.disposePlan?.bind(bridge),
				'java.disposePlan',
				'Prepared Java calls are unavailable.',
			)(plan);
			plans.delete(plan);

			if (untrackHandle(plan)) {
				dropJavaHandle(plan);
			}
		},
		invokeAsync: (handle, name, args) =>
			scopeAsyncMethod(
				bridge.invokeAsync?.bind(bridge),
				'java.invokeAsync',
				'Asynchronous Java invocation is unavailable.',
			)(handle, name, args ?? []),
		getField: scopeMethod(bridge.getField.bind(bridge), 'java.getField'),
		setField: scopeMethod(bridge.setField.bind(bridge), 'java.setField'),
		batch: scopeMethod(bridge.batch.bind(bridge), 'java.batch'),
		batchAsync: scopeAsyncMethod(
			bridge.batchAsync?.bind(bridge),
			'java.batchAsync',
			'Asynchronous Java batches are unavailable.',
		),
		findViews: (root, className, options) =>
			scopeAsyncMethod(
				bridge.findViews?.bind(bridge),
				'java.findViews',
				'Java view searches are unavailable.',
			)(root, className, options),
		createAssociationKey: scopeMethod(
			bridge.createAssociationKey.bind(bridge),
			'java.createAssociationKey',
		),
		getAssociatedObject: scopeMethod(
			bridge.getAssociatedObject.bind(bridge),
			'java.getAssociatedObject',
		),
		setAssociatedObject: scopeMethod(
			bridge.setAssociatedObject.bind(bridge),
			'java.setAssociatedObject',
		),
		release: (handle) => {
			const release = scopeMethod(bridge.release.bind(bridge), 'java.release');
			const held = untrackHandle(handle);

			if (held ? dropJavaHandle(handle) : !javaHandleHolders.has(handle)) {
				release(handle);
			}
		},
	};

	return {
		bridge: scopedBridge,
		dispose: () => {
			for (const tracked of handles) {
				const handle = tracked.deref();

				if (!handle || !dropJavaHandle(handle)) {
					continue;
				}

				try {
					bridge.release(handle);
				} catch {
					continue;
				}
			}

			handles.clear();
			plans.clear();
		},
	};
}
