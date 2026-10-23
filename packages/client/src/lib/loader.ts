import { createLogger } from '@unbound-app/logger';

// `window` is referenced throughout the client but the host only defines it later in its own
// bundle, so alias it to the global object up front.
globalThis.window ??= globalThis as typeof window;

const logger = createLogger('Loader');

type ReadyCallback = () => void;

type ReadyState = {
	ready: boolean;
	callbacks: ReadyCallback[];
};

type RuntimeGlobal = typeof globalThis & {
	__unboundReady?: ReadyState;
};

const runtimeGlobal = globalThis as RuntimeGlobal;
const readyState = (runtimeGlobal.__unboundReady ??= {
	ready: false,
	callbacks: [],
});

/** Marks Unbound as ready and runs every callback waiting on it. */
export function markReady(): void {
	if (readyState.ready) return;

	readyState.ready = true;

	for (const callback of readyState.callbacks.splice(0)) callback();
}

/** A native → JS method that may be held back. */
// UNKNOWN: matches any method; the held method's own return type flows through `ReturnType`.
type NativeMethod = (...args: never[]) => unknown;

/** Replays a native → JS call held back until our initialization has finished. */
type DeferredCall = () => void;

const deferredCalls: DeferredCall[] = [];
const unpatches: (() => void)[] = [];

/**
 * @description Defers Unbound's initialization until the Metro module registry is populated and the
 * native run-application call has been intercepted, then runs `onReady` before releasing Discord and
 * any held native calls. Twin of the host loader pattern in `revenge-bundle`.
 * @param onReady Runs once the registry is ready; resolve it before Discord and deferred calls flush.
 */
export default function deferUntilReady(onReady: () => Promise<void>): void {
	// `__r` already exists: the hook point is gone (legacy Vendetta-style loader). Initialize now.
	if (typeof window.__r !== 'undefined') {
		void runReady(onReady).then((initialized) => {
			if (initialized) {
				markReady();
			}
		});

		return;
	}

	let requireFn: ((id: number) => ReturnType<MetroRequire>) | undefined;

	Object.defineProperties(globalThis, {
		__r: {
			configurable: true,
			get: () => requireFn,
			set(original: MetroRequire) {
				requireFn = function patchedRequire(id: number) {
					if (id !== 0) {
						return original(id);
					}

					onRunApplication(original, onReady);
					requireFn = original;
				};
			},
		},
		__d: {
			configurable: true,
			get() {
				return this.value;
			},
			set(value: MetroDefine) {
				this.value = value;
			},
		},
	});
}

/**
 * Handles the native `__r(0)` "run application" call: holds outstanding native calls, runs our
 * initialization, then starts Discord and flushes everything we held back.
 */
function onRunApplication(original: MetroRequire, onReady: () => Promise<void>) {
	holdNativeCalls();

	void runReady(onReady).then((initialized) => {
		for (const unpatch of unpatches.splice(0)) unpatch();

		original(0);
		resumeDeferred();

		if (initialized) {
			markReady();
		}
	});
}

/** Runs the readiness callback, surfacing any failure the same way the entry point used to. */
async function runReady(onReady: () => Promise<void>): Promise<boolean> {
	try {
		await onReady();

		return true;
	} catch (error) {
		const message =
			typeof error === 'object' && error !== null && 'stack' in error
				? String(error.stack)
				: String(error);

		logger.error('Failed to initialize Unbound:', error);
		alert(`Unbound failed to initialize: ${message}`);

		return false;
	}
}

/**
 * Intercepts the native → JS entry points of an un-run app (the old architecture's batched bridge
 * and the New Architecture's app registry). Held calls replay in {@link resumeDeferred}.
 */
function holdNativeCalls() {
	const bridge = window.__fbBatchedBridge;

	if (bridge) {
		deferMethodExecution(
			bridge,
			'callFunctionReturnFlushedQueue',
			() => bridge.flushedQueue(),
			// Hold AppRegistry calls (the app is not registered until we run it) and any module that
			// is not yet callable; everything else passes through immediately.
			(module) => module === 'AppRegistry' || !bridge.getCallableModule(module),
			(module, method, args) => {
				if (bridge.getCallableModule(module)) {
					bridge.__callFunction(module, method, args);
				}
			},
		);
	}

	const registry = window.RN$AppRegistry;

	if (registry) {
		deferMethodExecution(registry, 'runApplication', () => undefined);
	}
}

/**
 * Wraps `object[method]` so that matching calls are queued instead of executed, recording an
 * unpatch to restore the original. Twin of {@link resumeDeferred}.
 * @param object The object owning the method.
 * @param method The name of the method to wrap.
 * @param returnWith Produces the value returned to the caller while the call is held.
 * @param condition Decides whether a call should be held; every call is held by default.
 * @param resume Replays a held call; defaults to invoking the method with its args.
 */
function deferMethodExecution<T extends Record<K, NativeMethod>, K extends keyof T>(
	object: T,
	method: K,
	returnWith: () => ReturnType<T[K]>,
	condition: (...args: Parameters<T[K]>) => boolean = () => true,
	resume: (...args: Parameters<T[K]>) => void = (...args) =>
		Reflect.apply(object[method], object, args),
) {
	const original = object[method];

	function patched(this: T, ...args: Parameters<T[K]>): ReturnType<T[K]> {
		if (!condition(...args)) {
			return Reflect.apply(original, this, args);
		}

		deferredCalls.push(() => resume(...args));

		return returnWith();
	}

	Reflect.set(object, method, patched);
	unpatches.push(() => Reflect.set(object, method, original));
}

/** Replays every held native call in order, then clears the queue. Twin of {@link holdNativeCalls}. */
function resumeDeferred() {
	for (const replay of deferredCalls.splice(0)) {
		replay();
	}
}
