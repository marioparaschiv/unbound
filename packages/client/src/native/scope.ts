import type {
	NativeAssociationKey,
	NativeCallOptions,
	NativeCancelablePromise,
	NativeClassHandle,
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
	NativePluginMethod,
	NativePluginPlatform,
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeRuntimeEventToken,
	NativeSerializableObject,
} from '@unbound-app/types';

import { requireCapability, scopedMethod, unavailableNativePlugin } from '~/native/capabilities';
import { NativePluginDisposedError, NativePluginUnavailableError } from '~/native/errors';
import { createFluxRuntimeBridge } from '~/flux/runtime-bridge';
import type { AddonAttribution } from '~/addons/crash-guard';
import { getNativePlugin } from '~/native/plugin-bridge';

type AssociationBinding = {
	handle: NativeObjectHandle;
	key: NativeAssociationKey;
};

const JAVA_HANDLE_PRUNE_SIZE = 1_024;
const javaHandleHolders = new WeakMap<NativeJavaReference, number>();

function holdJavaHandle(handle: NativeJavaReference) {
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

type ScopedNativePlugin = {
	bridge: NativePluginBridge;
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
		path: NativePluginMethod,
	) {
		return scopedMethod(method, capabilities, path, () => !disposed);
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

	const objc: NativeObjCBridge = {
		getClass: scopeMethod(objcBridge.getClass.bind(objcBridge), 'objc.getClass'),
		alloc: scopeMethod(objcBridge.alloc.bind(objcBridge), 'objc.alloc'),
		create: scopeMethod(
			(
				classOrName: string | NativeClassHandle,
				initSelector: string,
				args: unknown[] = [],
				options?: NativeCallOptions,
			) => {
				const instance = objcBridge.alloc(classOrName);
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
		hook: (
			className: string,
			selector: string,
			handlers: NativeHookHandlers,
			options?: NativeHookOptions,
		) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, 'objc.hook');
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

	function trackJavaHandle(handle: NativeJavaHandle): NativeJavaHandle {
		if (javaHandles.size >= JAVA_HANDLE_PRUNE_SIZE) {
			for (const tracked of javaHandles) {
				if (!tracked.deref()) {
					javaHandles.delete(tracked);
				}
			}
		}

		if (!holdsJavaHandle(handle)) {
			javaHandles.add(new WeakRef(handle));
			holdJavaHandle(handle);
		}

		return handle;
	}

	function holdsJavaHandle(handle: NativeJavaReference): boolean {
		for (const tracked of javaHandles) {
			if (tracked.deref() === handle) {
				return true;
			}
		}

		return false;
	}

	function untrackJavaHandle(handle: NativeJavaReference): boolean {
		let held = false;

		for (const tracked of javaHandles) {
			if (tracked.deref() === handle) {
				javaHandles.delete(tracked);
				held = true;
			}
		}

		return held;
	}

	const java: NativeJavaBridge = {
		getClass: (name) =>
			trackJavaHandle(
				scopeMethod(javaBridge.getClass.bind(javaBridge), 'java.getClass')(name),
			),
		className: scopeMethod(javaBridge.className.bind(javaBridge), 'java.className'),
		describe: scopeMethod(javaBridge.describe.bind(javaBridge), 'java.describe'),
		construct: (name, args) =>
			trackJavaHandle(
				scopeMethod(javaBridge.construct.bind(javaBridge), 'java.construct')(
					name,
					args ?? [],
				),
			),
		respondsTo: (handle, name, args) =>
			scopeMethod(javaBridge.respondsTo.bind(javaBridge), 'java.respondsTo')(
				handle,
				name,
				args ?? [],
			),
		invoke: (handle, name, args) =>
			scopeMethod(javaBridge.invoke.bind(javaBridge), 'java.invoke')(
				handle,
				name,
				args ?? [],
			),
		invokeAsync: (handle, name, args) =>
			scopeAsyncMethod(
				javaBridge.invokeAsync?.bind(javaBridge),
				'java.invokeAsync',
				'Asynchronous Java invocation is unavailable.',
			)(handle, name, args ?? []),
		getField: scopeMethod(javaBridge.getField.bind(javaBridge), 'java.getField'),
		setField: scopeMethod(javaBridge.setField.bind(javaBridge), 'java.setField'),
		batch: scopeMethod(javaBridge.batch.bind(javaBridge), 'java.batch'),
		batchAsync: scopeAsyncMethod(
			javaBridge.batchAsync?.bind(javaBridge),
			'java.batchAsync',
			'Asynchronous Java batches are unavailable.',
		),
		findViews: (root, className, options) =>
			scopeAsyncMethod(
				javaBridge.findViews?.bind(javaBridge),
				'java.findViews',
				'Java view searches are unavailable.',
			)(root, className, options),
		createAssociationKey: scopeMethod(
			javaBridge.createAssociationKey.bind(javaBridge),
			'java.createAssociationKey',
		),
		getAssociatedObject: scopeMethod(
			javaBridge.getAssociatedObject.bind(javaBridge),
			'java.getAssociatedObject',
		),
		setAssociatedObject: scopeMethod(
			javaBridge.setAssociatedObject.bind(javaBridge),
			'java.setAssociatedObject',
		),
		release: (handle) => {
			const release = scopeMethod(javaBridge.release.bind(javaBridge), 'java.release');
			const held = untrackJavaHandle(handle);

			if (held ? dropJavaHandle(handle) : !javaHandleHolders.has(handle)) {
				release(handle);
			}
		},
	};

	const debug: NativeDebugBridge = {
		recordEvaluation: scopeMethod(
			debugBridge.recordEvaluation.bind(debugBridge),
			'debug.recordEvaluation',
		),
		environment: scopeMethod(debugBridge.environment.bind(debugBridge), 'debug.environment'),
	};

	const hooks: NativeJavaHooksBridge = {
		hook: (className, methodName, parameterTypes, options, listener) => {
			const token = scopeMethod(hooksBridge.hook.bind(hooksBridge), 'hooks.hook')(
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

				if (!handle || !dropJavaHandle(handle)) {
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
