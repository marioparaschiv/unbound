import type {
	NativeAssociationKey,
	NativeCallOptions,
	NativeCancelablePromise,
	NativeClassHandle,
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
	NativePluginMethod,
	NativePluginPlatform,
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeRuntimeEventToken,
	NativeSerializableObject,
} from '@unbound-app/types';

import { requireCapability, scopedMethod, unavailableNativePlugin } from '~/native/capabilities';
import { NativePluginDisposedError, NativePluginUnavailableError } from '~/native/errors';
import { createMainThreadAlloc } from '~/native/main-thread-alloc';
import { createFluxRuntimeBridge } from '~/flux/runtime-bridge';
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

function isObjectHandle(value: unknown): value is NativeObjectHandle {
	return typeof value === 'object' && value !== null;
}

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
	const objcBridge = attributeBridge(bridge.objc ?? fallbackBridge.objc, attribute);
	const ffiBridge = attributeBridge(bridge.ffi ?? fallbackBridge.ffi, attribute);
	const fabricBridge = attributeBridge(
		withFallback(bridge.fabric, fallbackBridge.fabric),
		attribute,
	);
	const runtimeBridge =
		platform === 'android' && capabilities.includes('native.runtime.events')
			? createFluxRuntimeBridge()
			: (bridge.runtime ??
				(capabilities.includes('native.runtime.events')
					? createFluxRuntimeBridge()
					: fallbackBridge.runtime));
	const javaBridge = attributeBridge(bridge.java ?? fallbackBridge.java, attribute);
	const hooksBridge = attributeBridge(bridge.hooks ?? fallbackBridge.hooks, attribute);
	const debugBridge = attributeBridge(bridge.debug ?? fallbackBridge.debug, attribute);
	const tokens = new Set<NativeHookToken>();
	const objcPlans = new Set<NativeObjCCallPlan>();
	const surfaces = new Set<NativeFabricSurface>();
	const javaHookTokens = new Set<NativeJavaHookToken>();
	const runtimeTokens = new Set<NativeRuntimeEventToken>();
	const pendingInvocations = new Set<NativeCancelablePromise<unknown>>();
	const associations: AssociationBinding[] = [];
	const ui = createScopedUIBridge(capabilities, platform);
	let disposed = false;
	let stopping = false;
	const mountAsync = fabricBridge.mountAsync?.bind(fabricBridge);
	const unmountAsync = fabricBridge.unmountAsync?.bind(fabricBridge);

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
			if (unmountAsync) {
				void unmountAsync(surface).catch(() => undefined);

				return;
			}

			fabricBridge.unmount(surface);
		} catch {
			return;
		}
	}

	function scopeMethod<A extends unknown[], R>(
		method: (...args: A) => R,
		path: NativePluginMethod,
	) {
		return scopedMethod(method, capabilities, path, () => !disposed);
	}

	function scopeOptionalMethod<A extends unknown[], R>(
		method: ((...args: A) => R) | undefined,
		path: NativePluginMethod,
		unavailableMessage: string,
	): (...args: A) => R {
		return (...args: A) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, path);

			if (!method) {
				throw new NativePluginUnavailableError(unavailableMessage);
			}

			return method(...args);
		};
	}

	function scopeAsyncMethod<A extends unknown[], R>(
		method: ((...args: A) => NativeCancelablePromise<R>) | undefined,
		path: NativePluginMethod,
		unavailableMessage: string,
	): (...args: A) => NativeCancelablePromise<R> {
		return (...args: A) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, path);

			if (!method) {
				throw new NativePluginUnavailableError(unavailableMessage);
			}

			return trackInvocation(method(...args));
		};
	}

	const allocObject = createMainThreadAlloc(objcBridge);

	const objc: NativeObjCBridge = {
		getClass: scopeMethod(objcBridge.getClass.bind(objcBridge), 'objc.getClass'),
		alloc: scopeMethod(allocObject, 'objc.alloc'),
		create: scopeMethod(
			(
				classOrName: string | NativeClassHandle,
				initSelector: string,
				args: unknown[] = [],
				options?: NativeCallOptions,
			) => {
				const instance = allocObject(classOrName);
				const initialized = objcBridge.invoke(instance, initSelector, args, options);

				if (!isObjectHandle(initialized)) {
					throw new Error(`${initSelector} returned nil.`);
				}

				return initialized;
			},
			'objc.create',
		),
		className: scopeMethod(objcBridge.className.bind(objcBridge), 'objc.className'),
		respondsTo: scopeMethod(objcBridge.respondsTo.bind(objcBridge), 'objc.respondsTo'),
		call: scopeMethod(objcBridge.call.bind(objcBridge), 'objc.call'),
		callSuper: scopeMethod(objcBridge.callSuper.bind(objcBridge), 'objc.callSuper'),
		invoke: scopeMethod(objcBridge.invoke.bind(objcBridge), 'objc.invoke'),
		invokeAsync: scopeAsyncMethod(
			objcBridge.invokeAsync?.bind(objcBridge),
			'objc.invokeAsync',
			'Async native invocation is unavailable.',
		),
		prepare: (handle, selector) => {
			const plan = scopeOptionalMethod(
				objcBridge.prepare?.bind(objcBridge),
				'objc.prepare',
				'Prepared Objective-C calls are unavailable.',
			)(handle, selector);

			objcPlans.add(plan);

			return plan;
		},
		invokePrepared: (plan, handle, args, options) => {
			if (!objcPlans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Objective-C call plan is outside this plugin scope.',
				);
			}

			return scopeOptionalMethod(
				objcBridge.invokePrepared?.bind(objcBridge),
				'objc.invokePrepared',
				'Prepared Objective-C calls are unavailable.',
			)(plan, handle, args, options);
		},
		invokePreparedAsync: (plan, handle, args) => {
			if (!objcPlans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Objective-C call plan is outside this plugin scope.',
				);
			}

			return scopeAsyncMethod(
				objcBridge.invokePreparedAsync?.bind(objcBridge),
				'objc.invokePreparedAsync',
				'Prepared asynchronous Objective-C calls are unavailable.',
			)(plan, handle, args);
		},
		disposePlan: (plan) => {
			if (!objcPlans.has(plan)) {
				throw new NativePluginUnavailableError(
					'The Objective-C call plan is outside this plugin scope.',
				);
			}

			scopeOptionalMethod(
				objcBridge.disposePlan?.bind(objcBridge),
				'objc.disposePlan',
				'Prepared Objective-C calls are unavailable.',
			)(plan);
			objcPlans.delete(plan);
		},
		batch: scopeAsyncMethod(
			objcBridge.batch?.bind(objcBridge),
			'objc.batch',
			'Native batch is unavailable.',
		),
		snapshot: scopeAsyncMethod(
			objcBridge.snapshot?.bind(objcBridge),
			'objc.snapshot',
			'Native UI snapshot is unavailable.',
		),
		findViews: scopeAsyncMethod(
			objcBridge.findViews?.bind(objcBridge),
			'objc.findViews',
			'Native view search is unavailable.',
		),
		invokeSuper: scopeMethod(objcBridge.invokeSuper.bind(objcBridge), 'objc.invokeSuper'),
		invokeSuperAsync: scopeAsyncMethod(
			objcBridge.invokeSuperAsync?.bind(objcBridge),
			'objc.invokeSuperAsync',
			'Async native super invocation is unavailable.',
		),
		getIvar: scopeMethod(objcBridge.getIvar.bind(objcBridge), 'objc.getIvar'),
		setIvar: scopeMethod(objcBridge.setIvar.bind(objcBridge), 'objc.setIvar'),
		createAssociationKey: scopeMethod(
			objcBridge.createAssociationKey.bind(objcBridge),
			'objc.createAssociationKey',
		),
		getAssociatedObject: scopeMethod(
			objcBridge.getAssociatedObject.bind(objcBridge),
			'objc.getAssociatedObject',
		),
		setAssociatedObject: (handle, key, value, policy) => {
			scopeMethod(
				objcBridge.setAssociatedObject.bind(objcBridge),
				'objc.setAssociatedObject',
			)(handle, key, value, policy);
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
		struct: scopeMethod(objcBridge.struct.bind(objcBridge), 'objc.struct'),
		array: scopeMethod(objcBridge.array.bind(objcBridge), 'objc.array'),
		data: scopeMethod(objcBridge.data.bind(objcBridge), 'objc.data'),
		hook: <Receiver extends boolean = true>(
			className: string,
			selector: string,
			handlers: NativeHookHandlers<Receiver>,
			options?: NativeHookOptions<Receiver>,
		) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'objc.hook');
			const token = objcBridge.hook<Receiver>(className, selector, handlers, options);

			tokens.add(token);

			return {
				get active() {
					return token.active;
				},
				setReturnValue(self, args, value) {
					if (disposed) {
						throw new NativePluginDisposedError();
					}

					token.setReturnValue(self, args, value);
				},
				removeReturnValue(self, args) {
					if (disposed) {
						throw new NativePluginDisposedError();
					}

					token.removeReturnValue(self, args);
				},
				clearReturnValues() {
					if (disposed) {
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
		symbol: scopeMethod(ffiBridge.symbol.bind(ffiBridge), 'ffi.symbol'),
		call: scopeMethod(ffiBridge.call.bind(ffiBridge), 'ffi.call'),
	};

	const fabric: NativeFabricBridge = {
		mount: (container, moduleName, properties) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'fabric.mount');
			const surface = fabricBridge.mount(container, moduleName, properties);

			surfaces.add(surface);

			return surface;
		},
		mountAsync: (container, moduleName, properties) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'fabric.mountAsync');

			if (!mountAsync) {
				throw new NativePluginUnavailableError('Async Fabric mounting is unavailable.');
			}

			const pending = trackInvocation(mountAsync(container, moduleName, properties));

			pending.then(
				(surface) => {
					if (disposed) {
						disposeSurface(surface);
					} else {
						surfaces.add(surface);
					}
				},
				() => undefined,
			);

			return pending;
		},
		update: scopeMethod(fabricBridge.update.bind(fabricBridge), 'fabric.update'),
		updateAsync: scopeAsyncMethod(
			fabricBridge.updateAsync?.bind(fabricBridge),
			'fabric.updateAsync',
			'Async Fabric updates are unavailable.',
		),
		setSize: scopeMethod(fabricBridge.setSize.bind(fabricBridge), 'fabric.setSize'),
		setSizeAsync: scopeAsyncMethod(
			fabricBridge.setSizeAsync?.bind(fabricBridge),
			'fabric.setSizeAsync',
			'Async Fabric sizing is unavailable.',
		),
		setFrame: scopeMethod(fabricBridge.setFrame.bind(fabricBridge), 'fabric.setFrame'),
		setFrameAsync: scopeAsyncMethod(
			fabricBridge.setFrameAsync?.bind(fabricBridge),
			'fabric.setFrameAsync',
			'Async Fabric frame updates are unavailable.',
		),
		measure: scopeMethod(fabricBridge.measure.bind(fabricBridge), 'fabric.measure'),
		measureAsync: scopeAsyncMethod(
			fabricBridge.measureAsync?.bind(fabricBridge),
			'fabric.measureAsync',
			'Async Fabric measurement is unavailable.',
		),
		unmount: (surface) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'fabric.unmount');
			fabricBridge.unmount(surface);
			surfaces.delete(surface);
		},
		unmountAsync: (surface) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'fabric.unmountAsync');

			if (!unmountAsync) {
				throw new NativePluginUnavailableError('Async Fabric unmounting is unavailable.');
			}

			const pending = trackInvocation(unmountAsync(surface));

			pending.then(
				() => surfaces.delete(surface),
				() => undefined,
			);

			return pending;
		},
	};

	const runtime: NativeRuntimeBridge = {
		subscribe: (
			event: NativeRuntimeEventName,
			listener: (payload: NativeSerializableObject) => void,
		) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'runtime.subscribe');
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
		scopeMethod,
		scopeOptionalMethod,
		scopeAsyncMethod,
	});
	const java = scopedJava.bridge;

	const debug: NativeDebugBridge = {
		recordEvaluation: scopeMethod(
			debugBridge.recordEvaluation.bind(debugBridge),
			'debug.recordEvaluation',
		),
		environment: scopeMethod(debugBridge.environment.bind(debugBridge), 'debug.environment'),
	};

	const hooks: NativeJavaHooksBridge = {
		hook: <Receiver extends boolean = true>(
			className: string,
			methodName: string,
			parameterTypes: string[],
			options?: NativeJavaHookOptions<Receiver>,
			listener?: (event: NativeJavaHookEvent<Receiver>) => void,
		) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'hooks.hook');
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
		setReturnValue: scopeMethod(
			hooksBridge.setReturnValue.bind(hooksBridge),
			'hooks.setReturnValue',
		),
		removeReturnValue: scopeMethod(
			hooksBridge.removeReturnValue.bind(hooksBridge),
			'hooks.removeReturnValue',
		),
		clearReturnValues: scopeMethod(
			hooksBridge.clearReturnValues.bind(hooksBridge),
			'hooks.clearReturnValues',
		),
		remove: (token) => {
			javaHookTokens.delete(token);
			scopeMethod(hooksBridge.remove.bind(hooksBridge), 'hooks.remove')(token);
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
			if (disposed) return;

			disposed = true;
			ui.dispose();

			for (const pending of pendingInvocations) pending.cancel();

			pendingInvocations.clear();

			for (const token of tokens) token.remove();

			tokens.clear();

			for (const token of runtimeTokens) token.remove();

			runtimeTokens.clear();

			for (const surface of surfaces) disposeSurface(surface);

			surfaces.clear();

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
