import type {
	NativeAssociationKey,
	NativeCancelablePromise,
	NativeFabricBridge,
	NativeFabricSurface,
	NativeFFIBridge,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaReference,
	NativeDebugBridge,
	NativeJavaHooksBridge,
	NativeJavaHookToken,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	NativePluginBridge,
	NativePluginCapability,
	NativePluginPlatform,
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeRuntimeEventToken,
	NativeSerializableObject,
} from '@unbound-app/types';

import {
	debugCapabilities,
	fabricCapabilities,
	ffiCapabilities,
	hooksCapabilities,
	javaCapabilities,
	objcCapabilities,
	requireCapability,
	runtimeCapabilities,
	scopedMethod,
	unavailableNativePlugin,
} from '~/api/native-capabilities';
import { NativePluginDisposedError, NativePluginUnavailableError } from '~/api/native-errors';
import { createFluxRuntimeBridge } from '~/api/native-flux-bridge';
import { getNativePlugin } from '~/api/native-plugin-bridge';
import type { AddonAttribution } from '~/api/crash-guard';

type AssociationBinding = {
	handle: NativeObjectHandle;
	key: NativeAssociationKey;
};

const JAVA_HANDLE_PRUNE_SIZE = 1_024;

type ScopedNativePlugin = {
	bridge: NativePluginBridge;
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
	const surfaces = new Set<NativeFabricSurface>();
	const javaHandles = new Set<WeakRef<NativeJavaReference>>();
	const javaHookTokens = new Set<NativeJavaHookToken>();
	const runtimeTokens = new Set<NativeRuntimeEventToken>();
	const pendingInvocations = new Set<NativeCancelablePromise<unknown>>();
	const associations: AssociationBinding[] = [];
	let disposed = false;
	const mountAsync = fabricBridge.mountAsync?.bind(fabricBridge);
	const unmountAsync = fabricBridge.unmountAsync?.bind(fabricBridge);

	function trackInvocation<T>(pending: NativeCancelablePromise<T>): NativeCancelablePromise<T> {
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
		capability: NativePluginCapability,
	) {
		return scopedMethod(method, capabilities, capability, () => !disposed);
	}

	function scopeAsyncMethod<A extends unknown[], R>(
		method: ((...args: A) => NativeCancelablePromise<R>) | undefined,
		capability: NativePluginCapability,
		unavailableMessage: string,
	): (...args: A) => NativeCancelablePromise<R> {
		return (...args: A) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, capability);

			if (!method) {
				throw new NativePluginUnavailableError(unavailableMessage);
			}

			return trackInvocation(method(...args));
		};
	}

	const objc: NativeObjCBridge = {
		getClass: scopeMethod(objcBridge.getClass.bind(objcBridge), objcCapabilities.getClass),
		alloc: scopeMethod(objcBridge.alloc.bind(objcBridge), objcCapabilities.alloc),
		className: scopeMethod(objcBridge.className.bind(objcBridge), objcCapabilities.className),
		respondsTo: scopeMethod(
			objcBridge.respondsTo.bind(objcBridge),
			objcCapabilities.respondsTo,
		),
		call: scopeMethod(objcBridge.call.bind(objcBridge), objcCapabilities.call),
		callSuper: scopeMethod(objcBridge.callSuper.bind(objcBridge), objcCapabilities.callSuper),
		invoke: scopeMethod(objcBridge.invoke.bind(objcBridge), objcCapabilities.invoke),
		invokeAsync: scopeAsyncMethod(
			objcBridge.invokeAsync?.bind(objcBridge),
			objcCapabilities.invokeAsync,
			'Async native invocation is unavailable.',
		),
		batch: scopeAsyncMethod(
			objcBridge.batch?.bind(objcBridge),
			objcCapabilities.batch,
			'Native batch is unavailable.',
		),
		snapshot: scopeAsyncMethod(
			objcBridge.snapshot?.bind(objcBridge),
			objcCapabilities.snapshot,
			'Native UI snapshot is unavailable.',
		),
		findViews: scopeAsyncMethod(
			objcBridge.findViews?.bind(objcBridge),
			objcCapabilities.findViews,
			'Native view search is unavailable.',
		),
		invokeSuper: scopeMethod(
			objcBridge.invokeSuper.bind(objcBridge),
			objcCapabilities.invokeSuper,
		),
		invokeSuperAsync: scopeAsyncMethod(
			objcBridge.invokeSuperAsync?.bind(objcBridge),
			objcCapabilities.invokeSuperAsync,
			'Async native super invocation is unavailable.',
		),
		getIvar: scopeMethod(objcBridge.getIvar.bind(objcBridge), objcCapabilities.getIvar),
		setIvar: scopeMethod(objcBridge.setIvar.bind(objcBridge), objcCapabilities.setIvar),
		createAssociationKey: scopeMethod(
			objcBridge.createAssociationKey.bind(objcBridge),
			objcCapabilities.createAssociationKey,
		),
		getAssociatedObject: scopeMethod(
			objcBridge.getAssociatedObject.bind(objcBridge),
			objcCapabilities.getAssociatedObject,
		),
		setAssociatedObject: (handle, key, value, policy) => {
			scopeMethod(
				objcBridge.setAssociatedObject.bind(objcBridge),
				objcCapabilities.setAssociatedObject,
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
		struct: scopeMethod(objcBridge.struct.bind(objcBridge), objcCapabilities.struct),
		array: scopeMethod(objcBridge.array.bind(objcBridge), objcCapabilities.array),
		data: scopeMethod(objcBridge.data.bind(objcBridge), objcCapabilities.data),
		hook: (
			className: string,
			selector: string,
			handlers: NativeHookHandlers,
			options?: NativeHookOptions,
		) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, objcCapabilities.hook);
			const token = objcBridge.hook(className, selector, handlers, options);

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
		symbol: scopeMethod(ffiBridge.symbol.bind(ffiBridge), ffiCapabilities.symbol),
		call: scopeMethod(ffiBridge.call.bind(ffiBridge), ffiCapabilities.call),
	};

	const fabric: NativeFabricBridge = {
		mount: (container, moduleName, properties) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, fabricCapabilities.mount);
			const surface = fabricBridge.mount(container, moduleName, properties);

			surfaces.add(surface);

			return surface;
		},
		mountAsync: (container, moduleName, properties) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, fabricCapabilities.mountAsync);

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
		update: scopeMethod(fabricBridge.update.bind(fabricBridge), fabricCapabilities.update),
		updateAsync: scopeAsyncMethod(
			fabricBridge.updateAsync?.bind(fabricBridge),
			fabricCapabilities.updateAsync,
			'Async Fabric updates are unavailable.',
		),
		setSize: scopeMethod(fabricBridge.setSize.bind(fabricBridge), fabricCapabilities.setSize),
		setSizeAsync: scopeAsyncMethod(
			fabricBridge.setSizeAsync?.bind(fabricBridge),
			fabricCapabilities.setSizeAsync,
			'Async Fabric sizing is unavailable.',
		),
		setFrame: scopeMethod(
			fabricBridge.setFrame.bind(fabricBridge),
			fabricCapabilities.setFrame,
		),
		setFrameAsync: scopeAsyncMethod(
			fabricBridge.setFrameAsync?.bind(fabricBridge),
			fabricCapabilities.setFrameAsync,
			'Async Fabric frame updates are unavailable.',
		),
		measure: scopeMethod(fabricBridge.measure.bind(fabricBridge), fabricCapabilities.measure),
		measureAsync: scopeAsyncMethod(
			fabricBridge.measureAsync?.bind(fabricBridge),
			fabricCapabilities.measureAsync,
			'Async Fabric measurement is unavailable.',
		),
		unmount: (surface) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, fabricCapabilities.unmount);
			fabricBridge.unmount(surface);
			surfaces.delete(surface);
		},
		unmountAsync: (surface) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, fabricCapabilities.unmountAsync);

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

			requireCapability(capabilities, runtimeCapabilities.subscribe);
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

	function trackJavaHandle(handle: NativeJavaHandle): NativeJavaHandle {
		if (javaHandles.size >= JAVA_HANDLE_PRUNE_SIZE) {
			for (const tracked of javaHandles) {
				if (!tracked.deref()) {
					javaHandles.delete(tracked);
				}
			}
		}

		javaHandles.add(new WeakRef(handle));

		return handle;
	}

	function untrackJavaHandle(handle: NativeJavaReference) {
		for (const tracked of javaHandles) {
			if (tracked.deref() === handle) {
				javaHandles.delete(tracked);
			}
		}
	}

	const java: NativeJavaBridge = {
		getClass: (name) =>
			trackJavaHandle(
				scopeMethod(javaBridge.getClass.bind(javaBridge), javaCapabilities.getClass)(name),
			),
		className: scopeMethod(javaBridge.className.bind(javaBridge), javaCapabilities.className),
		describe: scopeMethod(javaBridge.describe.bind(javaBridge), javaCapabilities.describe),
		construct: (name, args) =>
			trackJavaHandle(
				scopeMethod(javaBridge.construct.bind(javaBridge), javaCapabilities.construct)(
					name,
					args ?? [],
				),
			),
		respondsTo: (handle, name, args) =>
			scopeMethod(javaBridge.respondsTo.bind(javaBridge), javaCapabilities.respondsTo)(
				handle,
				name,
				args ?? [],
			),
		invoke: (handle, name, args) =>
			scopeMethod(javaBridge.invoke.bind(javaBridge), javaCapabilities.invoke)(
				handle,
				name,
				args ?? [],
			),
		invokeAsync: (handle, name, args) =>
			scopeAsyncMethod(
				javaBridge.invokeAsync?.bind(javaBridge),
				javaCapabilities.invokeAsync,
				'Asynchronous Java invocation is unavailable.',
			)(handle, name, args ?? []),
		getField: scopeMethod(javaBridge.getField.bind(javaBridge), javaCapabilities.getField),
		setField: scopeMethod(javaBridge.setField.bind(javaBridge), javaCapabilities.setField),
		batch: scopeMethod(javaBridge.batch.bind(javaBridge), javaCapabilities.batch),
		batchAsync: scopeAsyncMethod(
			javaBridge.batchAsync?.bind(javaBridge),
			javaCapabilities.batchAsync,
			'Asynchronous Java batches are unavailable.',
		),
		findViews: (root, className, options) =>
			scopeAsyncMethod(
				javaBridge.findViews?.bind(javaBridge),
				javaCapabilities.findViews,
				'Java view searches are unavailable.',
			)(root, className, options),
		createAssociationKey: scopeMethod(
			javaBridge.createAssociationKey.bind(javaBridge),
			javaCapabilities.createAssociationKey,
		),
		getAssociatedObject: scopeMethod(
			javaBridge.getAssociatedObject.bind(javaBridge),
			javaCapabilities.getAssociatedObject,
		),
		setAssociatedObject: scopeMethod(
			javaBridge.setAssociatedObject.bind(javaBridge),
			javaCapabilities.setAssociatedObject,
		),
		release: (handle) => {
			untrackJavaHandle(handle);
			scopeMethod(javaBridge.release.bind(javaBridge), javaCapabilities.release)(handle);
		},
	};

	const debug: NativeDebugBridge = {
		recordEvaluation: scopeMethod(
			debugBridge.recordEvaluation.bind(debugBridge),
			debugCapabilities.recordEvaluation,
		),
		environment: scopeMethod(
			debugBridge.environment.bind(debugBridge),
			debugCapabilities.environment,
		),
	};

	const hooks: NativeJavaHooksBridge = {
		hook: (className, methodName, parameterTypes, options, listener) => {
			const token = scopeMethod(hooksBridge.hook.bind(hooksBridge), hooksCapabilities.hook)(
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
			hooksCapabilities.setReturnValue,
		),
		removeReturnValue: scopeMethod(
			hooksBridge.removeReturnValue.bind(hooksBridge),
			hooksCapabilities.removeReturnValue,
		),
		clearReturnValues: scopeMethod(
			hooksBridge.clearReturnValues.bind(hooksBridge),
			hooksCapabilities.clearReturnValues,
		),
		remove: (token) => {
			javaHookTokens.delete(token);
			scopeMethod(hooksBridge.remove.bind(hooksBridge), hooksCapabilities.remove)(token);
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
		},
		dispose: () => {
			if (disposed) return;

			disposed = true;

			for (const pending of pendingInvocations) pending.cancel();

			pendingInvocations.clear();

			for (const token of tokens) token.remove();

			tokens.clear();

			for (const token of runtimeTokens) token.remove();

			runtimeTokens.clear();

			for (const surface of surfaces) disposeSurface(surface);

			surfaces.clear();

			for (const tracked of javaHandles) {
				const handle = tracked.deref();

				if (!handle) {
					continue;
				}

				try {
					javaBridge.release(handle);
				} catch {
					continue;
				}
			}

			javaHandles.clear();

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
