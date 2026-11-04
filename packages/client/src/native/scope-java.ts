import type {
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

type ScopeBridgeMethod = <K extends keyof NativeJavaBridge>(
	source: NativeJavaBridge,
	name: K,
	path: NativePluginMethod,
	unavailableMessage?: string,
) => Exclude<NativeJavaBridge[K], undefined>;

type CreateScopedJavaBridgeOptions = {
	bridge: NativeJavaBridge;
	source: NativeJavaBridge;
	scopeBridgeMethod: ScopeBridgeMethod;
	scopeBridgeAsyncMethod: ScopeBridgeMethod;
};

type ScopedJavaBridge = {
	bridge: NativeJavaBridge;
	dispose: () => void;
};

/**
 * @description Builds a plugin's Java bridge, which tracks the handles and call plans it hands out so they are released when the plugin stops.
 * @param options The loader's Java bridge, attributed and as the loader gave it, and the scope's method wrappers.
 * @returns The scoped bridge and its `dispose`.
 */
export function createScopedJavaBridge({
	bridge,
	source,
	scopeBridgeMethod,
	scopeBridgeAsyncMethod,
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

	const getClass = scopeBridgeMethod(source, 'getClass', 'java.getClass');
	const construct = scopeBridgeMethod(source, 'construct', 'java.construct');
	const respondsTo = scopeBridgeMethod(source, 'respondsTo', 'java.respondsTo');
	const invoke = scopeBridgeMethod(source, 'invoke', 'java.invoke');
	const prepare = scopeBridgeMethod(
		source,
		'prepare',
		'java.prepare',
		'Prepared Java calls are unavailable.',
	);
	const invokePrepared = scopeBridgeMethod(
		source,
		'invokePrepared',
		'java.invokePrepared',
		'Prepared Java calls are unavailable.',
	);
	const invokePreparedAsync = scopeBridgeAsyncMethod(
		source,
		'invokePreparedAsync',
		'java.invokePreparedAsync',
		'Prepared asynchronous Java invocation is unavailable.',
	);
	const disposePlan = scopeBridgeMethod(
		source,
		'disposePlan',
		'java.disposePlan',
		'Prepared Java calls are unavailable.',
	);
	const invokeAsync = scopeBridgeAsyncMethod(
		source,
		'invokeAsync',
		'java.invokeAsync',
		'Asynchronous Java invocation is unavailable.',
	);
	const findViews = scopeBridgeAsyncMethod(
		source,
		'findViews',
		'java.findViews',
		'Java view searches are unavailable.',
	);
	const release = scopeBridgeMethod(source, 'release', 'java.release');

	const scopedBridge: NativeJavaBridge = {
		getClass: (name) => trackHandle(getClass(name)),
		className: scopeBridgeMethod(source, 'className', 'java.className'),
		describe: scopeBridgeMethod(source, 'describe', 'java.describe'),
		construct: (name, args) => trackHandle(construct(name, args ?? [])),
		respondsTo: (handle, name, args) => respondsTo(handle, name, args ?? []),
		invoke: (handle, name, args) => invoke(handle, name, args ?? []),
		prepare: (target, name, parameterTypes) => {
			const plan = trackHandle(prepare(target, name, parameterTypes));

			plans.add(plan);

			return plan;
		},
		invokePrepared: (plan, target, args) => {
			if (!plans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Java call plan is outside this plugin scope.',
				);
			}

			return invokePrepared(plan, target, args ?? []);
		},
		invokePreparedAsync: (plan, target, args) => {
			if (!plans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Java call plan is outside this plugin scope.',
				);
			}

			return invokePreparedAsync(plan, target, args ?? []);
		},
		disposePlan: (plan) => {
			if (!plans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Java call plan is outside this plugin scope.',
				);
			}

			disposePlan(plan);
			plans.delete(plan);

			if (untrackHandle(plan)) {
				dropJavaHandle(plan);
			}
		},
		invokeAsync: (handle, name, args) => invokeAsync(handle, name, args ?? []),
		getField: scopeBridgeMethod(source, 'getField', 'java.getField'),
		setField: scopeBridgeMethod(source, 'setField', 'java.setField'),
		batch: scopeBridgeMethod(source, 'batch', 'java.batch'),
		batchAsync: scopeBridgeAsyncMethod(
			source,
			'batchAsync',
			'java.batchAsync',
			'Asynchronous Java batches are unavailable.',
		),
		findViews: (root, className, options) => findViews(root, className, options),
		createAssociationKey: scopeBridgeMethod(
			source,
			'createAssociationKey',
			'java.createAssociationKey',
		),
		getAssociatedObject: scopeBridgeMethod(
			source,
			'getAssociatedObject',
			'java.getAssociatedObject',
		),
		setAssociatedObject: scopeBridgeMethod(
			source,
			'setAssociatedObject',
			'java.setAssociatedObject',
		),
		release: (handle) => {
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
