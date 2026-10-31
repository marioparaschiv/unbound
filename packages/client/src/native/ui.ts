import type {
	NativePluginCapability,
	NativePluginMethod,
	NativePluginPlatform,
	NativeUIArgument,
	NativeUIBridge,
	NativeUIScope,
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

type GuardedResult = { ok: true; value: unknown } | { ok: false; error: string };

// UNKNOWN: a plugin worklet may return any value the UI runtime can share back.
type PluginWorklet = (...args: never[]) => unknown;

type WorkletClosure = {
	worklet: PluginWorklet;
	runOnJS?: (callback: Settle) => Settle;
	settle?: Settle;
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

const REANIMATED_VERSION = '3.19.4';

const GUARDED_RUN = {
	hash: 0x75_6e_62_01,
	code: "function unboundGuardedRun(){const{worklet}=this.__closure;try{worklet.apply(undefined,arguments);}catch(error){console.error('[Unbound] A UI worklet failed: '+String(error));}}",
};

const GUARDED_CALL = {
	hash: 0x75_6e_62_03,
	code: 'function unboundGuardedCall(){const{worklet,runOnJS,settle}=this.__closure;let result;try{result={ok:true,value:worklet.apply(undefined,arguments)};}catch(error){result={ok:false,error:String(error)};}runOnJS(settle)(result);}',
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

function uiRuntime(): Required<UIRuntime> {
	const runtime = Reanimated as UIRuntime | undefined;

	if (!runtime?.runOnJS || !runtime.runOnUI) {
		throw new NativePluginUnavailableError('The UI runtime is unavailable.');
	}

	return runtime as Required<UIRuntime>;
}

function guardWorklet<A extends NativeUIArgument[]>(
	guard: WorkletGuard,
	closure: WorkletClosure,
): UIWorklet<A, void> {
	return Object.assign(() => undefined, {
		__closure: closure,
		__workletHash: guard.hash,
		__initData: {
			code: guard.code,
			location: 'unbound/native/ui',
			version: REANIMATED_VERSION,
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

				return new Promise((resolve, reject) => {
					const settle: Settle = (result) => {
						if (result.ok) {
							resolve(result.value as ReturnType<typeof worklet>);
						} else {
							reject(new Error(result.error));
						}
					};
					const guarded = guardWorklet<typeof args>(GUARDED_CALL, {
						worklet,
						runOnJS: runtime.runOnJS,
						settle,
					});

					runtime.runOnUI(guarded)(...args);
				});
			},
			run(worklet, ...args) {
				requireActive();
				const guarded = guardWorklet<typeof args>(GUARDED_RUN, { worklet });

				uiRuntime().runOnUI(guarded)(...args);
			},
		},
		dispose() {
			if (disposed) return;

			disposed = true;

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
