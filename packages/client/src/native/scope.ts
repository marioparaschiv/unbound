import type {
	NativeAssociationKey,
	NativeCancelablePromise,
	NativeFabricBridge,
	NativeFabricSurface,
	NativeFFIBridge,
	NativeJavaHookEvent,
	NativeJavaHookOptions,
	NativeDebugBridge,
	NativeJavaHooksBridge,
	NativeJavaHookToken,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjCCallPlan,
	NativeObjectHandle,
	NativePluginBridge,
	NativePluginCapability,
	NativePluginPlatform,
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeRuntimeEventToken,
	NativeSerializableObject,
} from '@unbound-app/types';

import { NativePluginDisposedError, NativePluginUnavailableError } from '~/native/errors';
import { createScopeGate, type ScopeLifecycle } from '~/native/scope-gate';
import { createFluxRuntimeBridge } from '~/flux/runtime-bridge';
import { unavailableNativePlugin } from '~/native/capabilities';
import { createObjectFactory } from '~/native/object-factory';
import type { AddonAttribution } from '~/addons/crash-guard';
import { createScopedJavaBridge } from '~/native/scope-java';
import { getNativePlugin } from '~/native/plugin-bridge';
import { createScopedUIBridge } from '~/native/ui';

type AssociationBinding = {
	handle: NativeObjectHandle;
	key: NativeAssociationKey;
};

type ScopedNativePlugin = {
	bridge: NativePluginBridge;
	beginStop: () => void;
	dispose: () => void;
};

function withFallback<T extends object>(bridge: Partial<T> | undefined, fallback: T): T {
	return new Proxy(fallback, {
		get: (target, property) => {
			const key = property as keyof T;

			return bridge?.[key] ?? target[key];
		},
	});
}

type AttributedMethod = {
	original: unknown;
	attributed: unknown;
};

function attributeBridge<T extends object>(source: T, attribute?: AddonAttribution): T {
	if (!attribute) {
		return source;
	}

	const methods = new Map<PropertyKey, AttributedMethod>();

	return new Proxy(source, {
		get: (target, property) => {
			const value: unknown = Reflect.get(target, property);

			if (typeof value !== 'function') {
				return value;
			}

			const cached = methods.get(property);

			if (cached?.original === value) {
				return cached.attributed;
			}

			const attributed = attribute(value.bind(target));

			methods.set(property, { original: value, attributed });

			return attributed;
		},
	});
}

/**
 * @description Wraps the native plugin bridge in a scope that allows only the declared capabilities and
 * releases every hook, surface, handle and subscription it handed out when disposed.
 * @param capabilities The capabilities the plugin declares for this platform.
 * @param platform The host platform.
 * @param attribute Marks the plugin as active in the loader's crash attribution while its native calls run.
 * @returns The scoped bridge and its `dispose`.
 */
export function createScopedNativePlugin(
	capabilities: readonly NativePluginCapability[],
	platform?: NativePluginPlatform,
	attribute?: AddonAttribution,
): ScopedNativePlugin {
	const fallbackBridge = unavailableNativePlugin();
	const bridge = getNativePlugin() ?? fallbackBridge;
	const objcSource = bridge.objc ?? fallbackBridge.objc;
	const ffiSource = bridge.ffi;
	const fabricSource = withFallback(bridge.fabric, fallbackBridge.fabric);
	const javaSource = bridge.java ?? fallbackBridge.java;
	const hooksSource = bridge.hooks ?? fallbackBridge.hooks;
	const debugSource = bridge.debug;
	const objcBridge = attributeBridge(objcSource, attribute);
	const fabricBridge = attributeBridge(fabricSource, attribute);
	const runtimeBridge = capabilities.includes('native.runtime.events')
		? createFluxRuntimeBridge()
		: fallbackBridge.runtime;
	const javaBridge = attributeBridge(javaSource, attribute);
	const hooksBridge = attributeBridge(hooksSource, attribute);
	const tokens = new Set<NativeHookToken>();
	const objcPlans = new Set<NativeObjCCallPlan>();
	const surfaces = new Set<NativeFabricSurface>();
	const javaHookTokens = new Set<NativeJavaHookToken>();
	const runtimeTokens = new Set<NativeRuntimeEventToken>();
	const pendingInvocations = new Set<NativeCancelablePromise<unknown>>();
	const associations: AssociationBinding[] = [];
	const ui = createScopedUIBridge(capabilities, platform);
	const lifecycle: ScopeLifecycle = { disposed: false };
	let stopping = false;
	const mountAsync = fabricBridge.mountAsync.bind(fabricBridge);
	const unmountAsync = fabricBridge.unmountAsync.bind(fabricBridge);
	const releaseIdleAsync = fabricBridge.releaseIdleAsync.bind(fabricBridge);

	function trackInvocation<T>(pending: NativeCancelablePromise<T>): NativeCancelablePromise<T> {
		if (stopping) {
			return pending;
		}

		pendingInvocations.add(pending);
		pending.then(
			() => pendingInvocations.delete(pending as NativeCancelablePromise<unknown>),
			() => pendingInvocations.delete(pending as NativeCancelablePromise<unknown>),
		);

		return pending;
	}

	function disposeSurface(surface: NativeFabricSurface): void {
		try {
			void unmountAsync(surface).catch(() => undefined);
		} catch {
			return;
		}
	}

	function releaseIdleSurfaces(): void {
		try {
			void releaseIdleAsync().catch(() => undefined);
		} catch {
			return;
		}
	}

	const {
		requireGranted,
		scopeMethod,
		scopeAsyncMethod,
		scopeBridgeMethod,
		scopeBridgeAsyncMethod,
	} = createScopeGate({ capabilities, attribute, lifecycle, track: trackInvocation });

	const prepareObjC = scopeBridgeMethod(
		objcSource,
		'prepare',
		'objc.prepare',
		'Prepared Objective-C calls are unavailable.',
	);
	const invokePreparedObjC = scopeBridgeMethod(
		objcSource,
		'invokePrepared',
		'objc.invokePrepared',
		'Prepared Objective-C calls are unavailable.',
	);
	const invokePreparedObjCAsync = scopeBridgeAsyncMethod(
		objcSource,
		'invokePreparedAsync',
		'objc.invokePreparedAsync',
		'Prepared asynchronous Objective-C calls are unavailable.',
	);
	const disposeObjCPlan = scopeBridgeMethod(
		objcSource,
		'disposePlan',
		'objc.disposePlan',
		'Prepared Objective-C calls are unavailable.',
	);
	const setObjCAssociatedObject = scopeBridgeMethod(
		objcSource,
		'setAssociatedObject',
		'objc.setAssociatedObject',
	);
	const removeJavaHook = scopeBridgeMethod(hooksSource, 'remove', 'hooks.remove');

	const objects = createObjectFactory(objcBridge);

	const objc: NativeObjCBridge = {
		getClass: scopeBridgeMethod(objcSource, 'getClass', 'objc.getClass'),
		alloc: scopeMethod(objects.alloc, 'objc.alloc'),
		create: scopeMethod(objects.create, 'objc.create'),
		className: scopeBridgeMethod(objcSource, 'className', 'objc.className'),
		respondsTo: scopeBridgeMethod(objcSource, 'respondsTo', 'objc.respondsTo'),
		call: scopeBridgeMethod(objcSource, 'call', 'objc.call'),
		callSuper: scopeBridgeMethod(objcSource, 'callSuper', 'objc.callSuper'),
		invoke: scopeBridgeMethod(objcSource, 'invoke', 'objc.invoke'),
		invokeAsync: scopeBridgeAsyncMethod(
			objcSource,
			'invokeAsync',
			'objc.invokeAsync',
			'Async native invocation is unavailable.',
		),
		prepare: (handle, selector) => {
			const plan = prepareObjC(handle, selector);

			objcPlans.add(plan);

			return plan;
		},
		invokePrepared: (plan, handle, args, options) => {
			if (!objcPlans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Objective-C call plan is outside this plugin scope.',
				);
			}

			return invokePreparedObjC(plan, handle, args, options);
		},
		invokePreparedAsync: (plan, handle, args) => {
			if (!objcPlans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Objective-C call plan is outside this plugin scope.',
				);
			}

			return invokePreparedObjCAsync(plan, handle, args);
		},
		disposePlan: (plan) => {
			if (!objcPlans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Objective-C call plan is outside this plugin scope.',
				);
			}

			disposeObjCPlan(plan);
			objcPlans.delete(plan);
		},
		batch: scopeBridgeAsyncMethod(
			objcSource,
			'batch',
			'objc.batch',
			'Native batch is unavailable.',
		),
		snapshot: scopeBridgeAsyncMethod(
			objcSource,
			'snapshot',
			'objc.snapshot',
			'Native UI snapshot is unavailable.',
		),
		findViews: scopeBridgeAsyncMethod(
			objcSource,
			'findViews',
			'objc.findViews',
			'Native view search is unavailable.',
		),
		invokeSuper: scopeBridgeMethod(objcSource, 'invokeSuper', 'objc.invokeSuper'),
		invokeSuperAsync: scopeBridgeAsyncMethod(
			objcSource,
			'invokeSuperAsync',
			'objc.invokeSuperAsync',
			'Async native super invocation is unavailable.',
		),
		getIvar: scopeBridgeMethod(objcSource, 'getIvar', 'objc.getIvar'),
		setIvar: scopeBridgeMethod(objcSource, 'setIvar', 'objc.setIvar'),
		createAssociationKey: scopeBridgeMethod(
			objcSource,
			'createAssociationKey',
			'objc.createAssociationKey',
		),
		getAssociatedObject: scopeBridgeMethod(
			objcSource,
			'getAssociatedObject',
			'objc.getAssociatedObject',
		),
		setAssociatedObject: (handle, key, value, policy) => {
			setObjCAssociatedObject(handle, key, value, policy);
			const index = associations.findIndex(
				(binding) => binding.handle === handle && binding.key === key,
			);

			if (value === null || value === undefined) {
				if (index !== -1) {
					associations.splice(index, 1);
				}

				return;
			}

			if (index === -1) {
				associations.push({ handle, key });
			}
		},
		struct: scopeBridgeMethod(objcSource, 'struct', 'objc.struct'),
		array: scopeBridgeMethod(objcSource, 'array', 'objc.array'),
		data: scopeBridgeMethod(objcSource, 'data', 'objc.data'),
		hook: <Receiver extends boolean = true>(
			className: string,
			selector: string,
			handlers: NativeHookHandlers<Receiver>,
			options?: NativeHookOptions<Receiver>,
		) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			requireGranted('objc.hook');
			const token = objcBridge.hook<Receiver>(className, selector, handlers, options);

			tokens.add(token);

			return {
				get active() {
					return token.active;
				},
				setReturnValue(self, args, value) {
					if (lifecycle.disposed) {
						throw new NativePluginDisposedError();
					}

					token.setReturnValue(self, args, value);
				},
				removeReturnValue(self, args) {
					if (lifecycle.disposed) {
						throw new NativePluginDisposedError();
					}

					token.removeReturnValue(self, args);
				},
				clearReturnValues() {
					if (lifecycle.disposed) {
						throw new NativePluginDisposedError();
					}

					token.clearReturnValues();
				},
				remove() {
					token.remove();
					tokens.delete(token);
				},
			};
		},
	};

	const ffi: NativeFFIBridge = {
		symbol: scopeBridgeMethod(ffiSource, 'symbol', 'ffi.symbol'),
		call: scopeBridgeMethod(ffiSource, 'call', 'ffi.call'),
	};

	const fabric: NativeFabricBridge = {
		mount: (container, moduleName, properties, options) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			requireGranted('fabric.mount');
			const surface = fabricBridge.mount(container, moduleName, properties, options);

			surfaces.add(surface);

			return surface;
		},
		mountAsync: (container, moduleName, properties, options) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			requireGranted('fabric.mountAsync');

			const pending = trackInvocation(mountAsync(container, moduleName, properties, options));

			pending.then(
				(surface) => {
					if (lifecycle.disposed) {
						disposeSurface(surface);
					} else {
						surfaces.add(surface);
					}
				},
				() => undefined,
			);

			return pending;
		},
		update: scopeBridgeMethod(fabricSource, 'update', 'fabric.update'),
		updateAsync: scopeBridgeAsyncMethod(
			fabricSource,
			'updateAsync',
			'fabric.updateAsync',
			'Async Fabric updates are unavailable.',
		),
		setSize: scopeBridgeMethod(fabricSource, 'setSize', 'fabric.setSize'),
		setSizeAsync: scopeBridgeAsyncMethod(
			fabricSource,
			'setSizeAsync',
			'fabric.setSizeAsync',
			'Async Fabric sizing is unavailable.',
		),
		setFrame: scopeBridgeMethod(fabricSource, 'setFrame', 'fabric.setFrame'),
		setFrameAsync: scopeBridgeAsyncMethod(
			fabricSource,
			'setFrameAsync',
			'fabric.setFrameAsync',
			'Async Fabric frame updates are unavailable.',
		),
		batchAsync: scopeBridgeAsyncMethod(
			fabricSource,
			'batchAsync',
			'fabric.batchAsync',
			'Frame-batched Fabric updates are unavailable.',
		),
		measure: scopeBridgeMethod(fabricSource, 'measure', 'fabric.measure'),
		measureAsync: scopeBridgeAsyncMethod(
			fabricSource,
			'measureAsync',
			'fabric.measureAsync',
			'Async Fabric measurement is unavailable.',
		),
		unmount: (surface) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			requireGranted('fabric.unmount');
			fabricBridge.unmount(surface);
			surfaces.delete(surface);
		},
		unmountAsync: (surface) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			requireGranted('fabric.unmountAsync');

			const pending = trackInvocation(unmountAsync(surface));

			pending.then(
				() => surfaces.delete(surface),
				() => undefined,
			);

			return pending;
		},
		releaseIdle: scopeBridgeMethod(
			fabricSource,
			'releaseIdle',
			'fabric.releaseIdle',
			'Releasing idle Fabric surfaces is unavailable.',
		),
		releaseIdleAsync: scopeAsyncMethod(
			releaseIdleAsync,
			'fabric.releaseIdleAsync',
			'Releasing idle Fabric surfaces is unavailable.',
		),
	};

	const runtime: NativeRuntimeBridge = {
		subscribe: (
			event: NativeRuntimeEventName,
			listener: (payload: NativeSerializableObject) => void,
		) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			requireGranted('runtime.subscribe');
			const token = runtimeBridge.subscribe(event, listener);

			runtimeTokens.add(token);

			return {
				get active() {
					return token.active;
				},
				remove() {
					token.remove();
					runtimeTokens.delete(token);
				},
			};
		},
	};

	const scopedJava = createScopedJavaBridge({
		bridge: javaBridge,
		source: javaSource,
		scopeBridgeMethod,
		scopeBridgeAsyncMethod,
	});
	const java = scopedJava.bridge;

	const debug: NativeDebugBridge = {
		recordEvaluation: scopeBridgeMethod(
			debugSource,
			'recordEvaluation',
			'debug.recordEvaluation',
		),
		environment: scopeBridgeMethod(debugSource, 'environment', 'debug.environment'),
	};

	const hooks: NativeJavaHooksBridge = {
		hook: <Receiver extends boolean = true>(
			className: string,
			methodName: string,
			parameterTypes: string[],
			options?: NativeJavaHookOptions<Receiver>,
			listener?: (event: NativeJavaHookEvent<Receiver>) => void,
		) => {
			if (lifecycle.disposed) {
				throw new NativePluginDisposedError();
			}

			requireGranted('hooks.hook');
			const token = hooksBridge.hook<Receiver>(
				className,
				methodName,
				parameterTypes,
				options,
				listener,
			);

			javaHookTokens.add(token);

			return token;
		},
		setReturnValue: scopeBridgeMethod(hooksSource, 'setReturnValue', 'hooks.setReturnValue'),
		removeReturnValue: scopeBridgeMethod(
			hooksSource,
			'removeReturnValue',
			'hooks.removeReturnValue',
		),
		clearReturnValues: scopeBridgeMethod(
			hooksSource,
			'clearReturnValues',
			'hooks.clearReturnValues',
		),
		remove: (token) => {
			javaHookTokens.delete(token);
			removeJavaHook(token);
		},
	};

	return {
		bridge: {
			apiVersion: bridge.apiVersion,
			abiVersion: bridge.abiVersion,
			capabilities: Object.freeze([...bridge.capabilities]),
			objc,
			ffi,
			fabric,
			runtime,
			java,
			hooks,
			debug,
			ui: ui.bridge,
		},
		beginStop: () => {
			stopping = true;
		},
		dispose: () => {
			if (lifecycle.disposed) return;

			lifecycle.disposed = true;
			ui.dispose();

			for (const pending of pendingInvocations) pending.cancel();

			pendingInvocations.clear();

			for (const token of tokens) token.remove();

			tokens.clear();

			for (const token of runtimeTokens) token.remove();

			runtimeTokens.clear();

			for (const surface of surfaces) disposeSurface(surface);

			surfaces.clear();
			releaseIdleSurfaces();

			for (const plan of objcPlans) {
				try {
					objcBridge.disposePlan?.(plan);
				} catch {
					continue;
				}
			}

			objcPlans.clear();

			scopedJava.dispose();

			for (const token of javaHookTokens) {
				try {
					hooksBridge.remove(token);
				} catch {
					continue;
				}
			}

			javaHookTokens.clear();

			for (const binding of associations) {
				objcBridge.setAssociatedObject(binding.handle, binding.key, null, 'assign');
			}

			associations.length = 0;
		},
	};
}

export default { createScopedNativePlugin };
