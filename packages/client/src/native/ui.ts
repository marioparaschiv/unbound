import type {
	NativePluginCapability,
	NativePluginMethod,
	NativePluginPlatform,
	NativeUIArgument,
	NativeUIBridge,
	NativeUIScope,
	NativeSerializable,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_METHOD_CAPABILITIES } from '@unbound-app/types/native';

import { NativePluginDisposedError, NativePluginUnavailableError } from '~/native/errors';
import { getNativePlugin } from '~/native/plugin-bridge';
import { findByPropsLazy } from '~/metro/wrappers';

type UIWorklet<A extends NativeUIArgument[], R> = (...args: A) => R;

type Settle = (result: GuardedResult) => void;

type UIRuntime = {
	runOnJS?: (callback: Settle) => Settle;
	runOnUI?: <A extends NativeUIArgument[]>(worklet: UIWorklet<A, void>) => (...args: A) => void;
};

type ResolvedUIRuntime = Required<UIRuntime> & { version: string };

type GuardedResult = { ok: true; value: unknown } | { ok: false; error: string };

// UNKNOWN: a plugin worklet may return any value the UI runtime can share back.
type PluginWorklet = (...args: never[]) => unknown;

type WorkletClosure = {
	worklet?: PluginWorklet;
	runOnJS?: (callback: Settle) => Settle;
	settle?: Settle;
	listener?: (...args: NativeSerializable[]) => void;
};

type WorkletGuard = {
	hash: number;
	code: string;
};

type ScopedUIBridge = {
	bridge: NativeUIBridge;
	dispose: () => void;
};

const Reanimated = findByPropsLazy('runOnJS', 'runOnUI');

const SUPPORTED_WORKLET_VERSIONS = new Set(['3.19.4']);

const GUARDED_RUN = {
	hash: 0x75_6e_62_01,
	code: "function unboundGuardedRun(){const{worklet}=this.__closure;try{worklet.apply(undefined,arguments);}catch(error){console.error('[Unbound] A UI worklet failed: '+String(error));}}",
};

const GUARDED_CALL = {
	hash: 0x75_6e_62_03,
	code: 'function unboundGuardedCall(){const{worklet,runOnJS,settle}=this.__closure;let result;try{result={ok:true,value:worklet.apply(undefined,arguments)};}catch(error){result={ok:false,error:String(error)};}runOnJS(settle)(result);}',
};

const JS_CALLBACK = {
	hash: 0x75_6e_62_05,
	code: 'function unboundJSCallback(){const{runOnJS,listener}=this.__closure;runOnJS(listener).apply(undefined,arguments);}',
};

const PROMISE_METHODS: ReadonlySet<NativePluginMethod> = new Set([
	'objc.batch',
	'objc.snapshot',
	'objc.findViews',
	'java.findViews',
]);

/**
 * @description Lists the method paths a UI scope may use: every synchronous method whose capability the plugin declares.
 * @param capabilities The capabilities the plugin declares.
 * @returns The method paths.
 */
export function uiScopePaths(
	capabilities: readonly NativePluginCapability[],
): NativePluginMethod[] {
	return (Object.keys(NATIVE_PLUGIN_METHOD_CAPABILITIES) as NativePluginMethod[]).filter(
		(path) =>
			capabilities.includes(NATIVE_PLUGIN_METHOD_CAPABILITIES[path]) &&
			!path.endsWith('Async') &&
			!PROMISE_METHODS.has(path),
	);
}

function createNativeScope(
	platform: NativePluginPlatform | undefined,
	paths: readonly string[],
): NativeUIScope {
	const bridge = getNativePlugin();
	const factory = platform === 'android' ? bridge?.java : bridge?.objc;

	if (!factory?.createUIScope) {
		throw new NativePluginUnavailableError('UI-runtime native scopes are unavailable.');
	}

	return factory.createUIScope(paths);
}

function uiRuntime(): ResolvedUIRuntime {
	const runtime = Reanimated as UIRuntime | undefined;

	if (!runtime?.runOnJS || !runtime.runOnUI) {
		throw new NativePluginUnavailableError('The UI runtime is unavailable.');
	}

	const version = Reflect.get(globalThis, '_REANIMATED_VERSION_JS');
	const nativeVersion = Reflect.get(globalThis, '_REANIMATED_VERSION_CPP');

	if (
		typeof version !== 'string' ||
		version !== nativeVersion ||
		!SUPPORTED_WORKLET_VERSIONS.has(version)
	) {
		throw new NativePluginUnavailableError(
			`The UI runtime version is unsupported (JS ${String(version)}, native ${String(nativeVersion)}).`,
		);
	}

	return { runOnJS: runtime.runOnJS, runOnUI: runtime.runOnUI, version };
}

function guardWorklet<A extends NativeUIArgument[]>(
	guard: WorkletGuard,
	closure: WorkletClosure,
	version: string,
): UIWorklet<A, void> {
	return Object.assign(() => undefined, {
		__closure: closure,
		__workletHash: guard.hash,
		__initData: {
			code: guard.code,
			location: 'unbound/native/ui',
			version,
		},
	});
}

/**
 * @description Builds a plugin's UI-runtime bridge, which opens native scopes limited to its capabilities and removes their hooks when disposed.
 * @param capabilities The capabilities the plugin declares for this platform.
 * @param platform The host platform.
 * @returns The bridge and its `dispose`.
 */
export function createScopedUIBridge(
	capabilities: readonly NativePluginCapability[],
	platform?: NativePluginPlatform,
): ScopedUIBridge {
	const scopes = new Set<NativeUIScope>();
	const pendingCalls = new Set<(error: Error) => void>();
	let disposed = false;

	function requireActive() {
		if (disposed) {
			throw new NativePluginDisposedError();
		}
	}

	return {
		bridge: {
			createScope() {
				requireActive();
				const scope = createNativeScope(platform, uiScopePaths(capabilities));

				scopes.add(scope);

				return scope;
			},
			call(worklet, ...args) {
				requireActive();
				const runtime = uiRuntime();

				let cancel = () => {};
				const pending = new Promise<ReturnType<typeof worklet>>((resolve, reject) => {
					let settled = false;

					function complete(action: () => void) {
						if (settled) return;

						settled = true;
						clearTimeout(timeout);
						pendingCalls.delete(rejectCall);
						action();
					}
					function rejectCall(error: Error) {
						complete(() => reject(error));
					}
					cancel = () =>
						rejectCall(
							Object.assign(new Error('The UI call was cancelled.'), {
								code: 'NATIVE_PLUGIN_CALL_CANCELLED',
							}),
						);
					pendingCalls.add(rejectCall);
					const timeout = setTimeout(
						() =>
							rejectCall(
								Object.assign(new Error('The UI call timed out.'), {
									code: 'NATIVE_PLUGIN_CALL_TIMEOUT',
								}),
							),
						5000,
					);
					const settle: Settle = (result) => {
						if (result.ok) {
							complete(() => resolve(result.value as ReturnType<typeof worklet>));
						} else {
							rejectCall(new Error(result.error));
						}
					};
					const guarded = guardWorklet<typeof args>(
						GUARDED_CALL,
						{
							worklet,
							runOnJS: runtime.runOnJS,
							settle,
						},
						runtime.version,
					);

					try {
						runtime.runOnUI(guarded)(...args);
					} catch (error) {
						rejectCall(error instanceof Error ? error : new Error(String(error)));
					}
				});

				return Object.assign(pending, { cancel: () => cancel() });
			},
			run(worklet, ...args) {
				requireActive();
				const runtime = uiRuntime();
				const guarded = guardWorklet<typeof args>(
					GUARDED_RUN,
					{ worklet },
					runtime.version,
				);

				runtime.runOnUI(guarded)(...args);
			},
			callback(listener) {
				requireActive();
				const runtime = uiRuntime();

				function forward(...args: NativeSerializable[]) {
					if (!disposed) {
						Reflect.apply(listener, undefined, args);
					}
				}

				return guardWorklet(
					JS_CALLBACK,
					{
						runOnJS: runtime.runOnJS,
						listener: forward,
					},
					runtime.version,
				);
			},
		},
		dispose() {
			if (disposed) return;

			disposed = true;

			for (const rejectCall of pendingCalls) {
				rejectCall(new NativePluginDisposedError());
			}

			pendingCalls.clear();

			for (const scope of scopes) {
				try {
					scope.dispose();
				} catch {
					continue;
				}
			}

			scopes.clear();
		},
	};
}

export default { createScopedUIBridge, uiScopePaths };
