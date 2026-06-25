import { createLogger } from '@unbound-app/logger';

// `window` is referenced throughout the client but the host only defines it later in its own
// bundle, so alias it to the global object up front.
globalThis.window ??= globalThis as typeof window;

const logger = createLogger('Loader');

/** A native → JS call held back until our initialization has finished. */
type DeferredCall = {
	object: any;
	method: string;
	args: any[];
	resume?: (call: DeferredCall) => void;
};

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
		void runReady(onReady);
		return;
	}

	let requireFn: any;

	Object.defineProperties(globalThis, {
		__r: {
			configurable: true,
			get: () => requireFn,
			set(original: MetroRequire) {
				requireFn = function patchedRequire(id: number) {
					if (id !== 0) return original(id);

					ensureModules();
					onRunApplication(original, onReady);
					requireFn = original;
				};
			},
		},
		__d: {
			configurable: true,
			get() {
				ensureModules();
				return this.value;
			},
			set(value: MetroDefine) {
				this.value = value;
			},
		},
	});
}

/** Populates `window.modules` from the host registry factory if it has not been materialised yet. */
function ensureModules() {
	// `window.Object` is guarded because the host has it momentarily undefined during early boot.
	if (!window.modules && typeof window.Object !== 'undefined') {
		const modules = window.__c?.();
		if (modules) window.modules = modules;
	}
}

/**
 * Handles the native `__r(0)` "run application" call: holds outstanding native calls, runs our
 * initialization, then starts Discord and flushes everything we held back.
 */
function onRunApplication(original: MetroRequire, onReady: () => Promise<void>) {
	ensureModules();
	holdNativeCalls();

	void runReady(onReady).then(() => {
		for (const unpatch of unpatches.splice(0)) unpatch();

		original(0);
		resumeDeferred();
	});
}

/** Runs the readiness callback, surfacing any failure the same way the entry point used to. */
async function runReady(onReady: () => Promise<void>) {
	try {
		await onReady();
	} catch (error: any) {
		const message = 'stack' in error ? error.stack : String(error);
		logger.error('Failed to initialize Unbound:', error);
		alert(`Unbound failed to initialize: ${message}`);
	}
}

/**
 * Intercepts the native → JS entry points that would otherwise drive an un-run app: the old
 * architecture's batched bridge and the New Architecture's app registry. Held calls replay in
 * {@link resumeDeferred}.
 */
function holdNativeCalls() {
	const bridge = window.__fbBatchedBridge;
	if (bridge) {
		deferMethodExecution(
			bridge,
			'callFunctionReturnFlushedQueue',
			// Hold AppRegistry calls (the app is not registered until we run it) and any module that
			// is not yet callable; everything else passes through immediately.
			(...args) => args[0] === 'AppRegistry' || !bridge.getCallableModule(args[0]),
			({ args }) => {
				if (bridge.getCallableModule(args[0])) {
					bridge.__callFunction(...args);
				}
			},
			() => bridge.flushedQueue(),
		);
	}

	const registry = window.RN$AppRegistry;
	if (registry) {
		deferMethodExecution(registry, 'runApplication');
	}
}

/**
 * Wraps `object[method]` so that matching calls are queued instead of executed, recording an
 * unpatch to restore the original. Twin of {@link resumeDeferred}.
 * @param condition Decides whether a call should be held; held when omitted.
 * @param resume Replays a held call; defaults to invoking the original method with its args.
 * @param returnWith Produces the value returned to the caller while the call is held.
 */
function deferMethodExecution(
	object: any,
	method: string,
	condition?: (...args: any[]) => boolean,
	resume?: (call: DeferredCall) => void,
	returnWith?: (call: DeferredCall) => any,
) {
	const original = object[method];

	object[method] = function (this: any, ...args: any[]) {
		if (condition && !condition(...args)) {
			return original.apply(this, args);
		}

		const call: DeferredCall = { object, method, args, resume };
		deferredCalls.push(call);

		return returnWith?.(call);
	};

	unpatches.push(() => {
		object[method] = original;
	});
}

/** Replays every held native call in order, then clears the queue. Twin of {@link holdNativeCalls}. */
function resumeDeferred() {
	for (const call of deferredCalls.splice(0)) {
		if (call.resume) {
			call.resume(call);
		} else {
			call.object[call.method](...call.args);
		}
	}
}
