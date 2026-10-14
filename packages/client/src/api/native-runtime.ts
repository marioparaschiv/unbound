import type {
	Fn,
	NativeAssociationKey,
	NativeCancelablePromise,
	NativeFabricBridge,
	NativeFabricSurface,
	NativeFiberHandle,
	NativeFFIBridge,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	NativePlatformBridge,
	NativePluginBridge,
	NativePluginCapability,
	NativeReactBridge,
	PluginContext,
	PromiseFn,
} from '@unbound-app/types';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { AddonManifest } from '@unbound-app/types/addons';

export type {
	NativeAssociationKey,
	NativeBatchReference,
	NativeBatchStep,
	NativeCancelablePromise,
	NativeCallOptions,
	NativeClassHandle,
	NativeFabricBridge,
	NativeFabricFrame,
	NativeFabricSize,
	NativeFabricSurface,
	NativeFiberHandle,
	NativeFFIBridge,
	NativeFFISignature,
	NativeFFIType,
	NativeFFITypeName,
	NativeHandle,
	NativeHookContext,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	NativePlatformBridge,
	NativePluginBridge,
	NativePluginCapability,
	NativeReactBridge,
	NativePluginError,
	NativePluginErrorCode,
	NativePointer,
	NativeStruct,
	NativeThreadPolicy,
	PluginContext,
} from '@unbound-app/types/native';

export type DCDFileManagerEncoding = 'utf-8' | 'utf8' | 'base64';

export interface DCDFileManagerConstants {
	CacheDirPath: string;
	DocumentsDirPath: string;
}

export interface DCDFileManagerType extends DCDFileManagerConstants {
	readFile(path: string, encoding: DCDFileManagerEncoding): Promise<string>;
	writeFile(
		type: 'documents' | 'cache',
		path: string,
		data: string,
		encoding: DCDFileManagerEncoding,
	): Promise<string>;
	removeFile(type: 'documents' | 'cache', path: string): Promise<any>;
	readAsset(): Promise<unknown>;
	getSize(): Promise<unknown>;
	getVideoDimensions(): Promise<unknown>;
	fileExists(path: string): Promise<boolean>;
	saveFileToGallery(): Promise<unknown>;
	getConstants(): DCDFileManagerConstants;
}

export interface BundleInfoType {
	Version: string;
	ReleaseChannel: string;
	Manifest: string;
	Build: string;
	SentryDsn: string;
	DeviceVendorID: string;
	OTABuild: string;
	SentryStaffDsn: string;
	Identifier: string;
	SentryAlphaBetaDsn: string;
}

export interface DeviceInfoType {
	isTaskBarEnabled: boolean;
	maxCpuFreq: string;
	socName: string;
	deviceModel: string;
	isTablet: boolean;
	isGestureNavigationEnabled: boolean;
	deviceProduct: string;
	systemVersion: string;
	deviceManufacturer: string;
	deviceBrand: string;
	ramSize: string;
	device: string;
}

export interface DCDBundleManagerType {
	getInitialBundleDownloaded: PromiseFn;
	getInitialOtaUpdateChecked: PromiseFn;
	checkForUpdateAndReload: Fn;
	reload: Fn;
	getOtaRootPath: PromiseFn;
	getBuildOverrideCookieContents: PromiseFn;
	setBuildOverrideCookieHeader: PromiseFn;
	getManifestInfo: PromiseFn;
	addListener: Fn;
	removeListeners: Fn;
}

export function getNativeModule<T = any>(...names: string[]): T {
	return [
		...names.map((n) => NativeModules[n]),
		...names.map((n) => TurboModuleRegistry.get?.(n)),
	].find((x) => x) as T;
}

export const BundleInfo: BundleInfoType = getNativeModule(
	'NativeClientInfoModule',
	'InfoDictionaryManager',
	'RTNClientInfoManager',
);
export const BundleManager: DCDBundleManagerType = getNativeModule('BundleUpdaterManager');
export const DeviceInfo: DeviceInfoType = getNativeModule('NativeDeviceModule', 'DCDDeviceManager');

export async function reload() {
	const { persist } = await import('~/api/storage');
	await persist();

	BundleManager.reload();
}

export function getRuntimeProperties(): Record<string, any> {
	return window.HermesInternal?.getRuntimeProperties() ?? {};
}

type NativeMethod = (...args: any[]) => any;
type NativePluginRuntimeGlobal = typeof globalThis & { NativePlugin?: NativePluginBridge };

type AssociationBinding = {
	handle: NativeObjectHandle;
	key: NativeAssociationKey;
};

type NativeReactRuntimeBridge = NativeReactBridge & {
	isSupported?: () => boolean;
	release?: (fiber: NativeFiberHandle) => void;
};

const nativePluginGlobal = globalThis as NativePluginRuntimeGlobal;
const nativePluginBridge = nativePluginGlobal.NativePlugin;

delete nativePluginGlobal.NativePlugin;

function getNativePlugin(): NativePluginBridge | undefined {
	return nativePluginBridge;
}

export const NativePlatform: NativePlatformBridge | undefined = globalThis.NativePlatform;

const capabilityRequirements: Record<string, NativePluginCapability> = {
	getClass: 'native.objc.classes',
	alloc: 'native.objc.classes',
	className: 'native.objc.classes',
	respondsTo: 'native.objc.classes',
	call: 'native.objc.invoke',
	callSuper: 'native.objc.invoke',
	invoke: 'native.objc.invoke',
	invokeAsync: 'native.objc.invokeAsync',
	batch: 'native.objc.batch',
	snapshot: 'native.objc.snapshot',
	findViews: 'native.objc.snapshot',
	invokeSuper: 'native.objc.invoke',
	invokeSuperAsync: 'native.objc.invokeAsync',
	getIvar: 'native.objc.ivars',
	setIvar: 'native.objc.ivars',
	createAssociationKey: 'native.objc.associations',
	getAssociatedObject: 'native.objc.associations',
	setAssociatedObject: 'native.objc.associations',
	struct: 'native.objc.classes',
	array: 'native.objc.classes',
	data: 'native.objc.classes',
	hook: 'native.objc.hooks',
	fabricMount: 'native.fabric.mount',
	fabricMountAsync: 'native.fabric.async',
	fabricUpdate: 'native.fabric.mount',
	fabricUpdateAsync: 'native.fabric.async',
	fabricSetSize: 'native.fabric.mount',
	fabricSetSizeAsync: 'native.fabric.async',
	fabricSetFrame: 'native.fabric.mount',
	fabricSetFrameAsync: 'native.fabric.async',
	fabricMeasure: 'native.fabric.mount',
	fabricMeasureAsync: 'native.fabric.async',
	fabricUnmount: 'native.fabric.mount',
	fabricUnmountAsync: 'native.fabric.async',
	reactGetFiber: 'native.react.remount',
	reactForceRemount: 'native.react.remount',
};

export class NativePluginUnavailableError extends Error {
	readonly code = 'NATIVE_PLUGIN_UNAVAILABLE';
}

export class NativePluginCapabilityError extends Error {
	readonly code = 'NATIVE_PLUGIN_CAPABILITY_DENIED';
	readonly capability: NativePluginCapability;

	constructor(capability: NativePluginCapability) {
		super(`Native plugin capability is not declared: ${capability}`);
		this.capability = capability;
	}
}

export class NativePluginVersionError extends Error {
	readonly code = 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED';
	readonly installedApi: string;
	readonly requiredApi: string;

	constructor(requiredApi: string, installedApi: string) {
		super(`Native plugin API ${requiredApi} is required, but ${installedApi} is installed.`);
		this.installedApi = installedApi;
		this.requiredApi = requiredApi;
	}
}

export class NativePluginDisposedError extends Error {
	readonly code = 'NATIVE_PLUGIN_SCOPE_DISPOSED';

	constructor() {
		super('The native plugin scope has been disposed.');
	}
}

export class NativeReactStaleFiberError extends Error {
	readonly code = 'NATIVE_REACT_STALE_FIBER';

	constructor() {
		super('Fiber handle is no longer active in this plugin scope.');
	}
}

function requireNativePlugin(): NativePluginBridge {
	const nativePlugin = getNativePlugin();
	if (!nativePlugin)
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	return nativePlugin;
}

function hasCapability(
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
): boolean {
	return capabilities.includes(capability);
}

function requireCapability(
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
): void {
	if (!hasCapability(capabilities, capability)) {
		throw new NativePluginCapabilityError(capability);
	}
}

function scopedMethod(
	method: NativeMethod,
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
	isActive: () => boolean = () => true,
): NativeMethod {
	return (...args: any[]) => {
		if (!isActive()) throw new NativePluginDisposedError();
		requireCapability(capabilities, capability);
		return method(...args);
	};
}

function compareVersions(left: string, right: string): number {
	const leftParts = left.split('.').map(Number);
	const rightParts = right.split('.').map(Number);
	const length = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < length; index++) {
		const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (difference !== 0) return difference;
	}

	return 0;
}

function unavailableNativePlugin(): NativePluginBridge {
	const unavailableMethod = () => {
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	};
	const unavailableObjC = new Proxy({}, { get: () => unavailableMethod }) as NativeObjCBridge;
	const unavailableFFI = new Proxy({}, { get: () => unavailableMethod }) as NativeFFIBridge;
	const unavailableFabric = new Proxy({}, { get: () => unavailableMethod }) as NativeFabricBridge;
	const unavailableReact = new Proxy({}, { get: () => unavailableMethod }) as NativeReactBridge;

	return {
		apiVersion: '0.0.0',
		abiVersion: '0.0.0',
		capabilities: [],
		objc: unavailableObjC,
		ffi: unavailableFFI,
		fabric: unavailableFabric,
		react: unavailableReact,
	};
}

function createScopedNativePlugin(capabilities: readonly NativePluginCapability[]): {
	bridge: NativePluginBridge;
	dispose: () => void;
} {
	const bridge = getNativePlugin() ?? unavailableNativePlugin();
	const fabricBridge = bridge.fabric ?? unavailableNativePlugin().fabric;
	const reactBridge: NativeReactRuntimeBridge = bridge.react ?? unavailableNativePlugin().react;
	const tokens = new Set<NativeHookToken>();
	const surfaces = new Set<NativeFabricSurface>();
	const fibers = new Set<NativeFiberHandle>();
	const pendingRemounts = new Map<NativeFiberHandle, NativeCancelablePromise<void>>();
	const pendingInvocations = new Set<NativeCancelablePromise<unknown>>();
	const associations: AssociationBinding[] = [];
	let disposed = false;
	const scopeMethod = (method: NativeMethod, capability: NativePluginCapability): NativeMethod =>
		scopedMethod(method, capabilities, capability, () => !disposed);
	const trackInvocation = <T>(
		pending: NativeCancelablePromise<T>,
	): NativeCancelablePromise<T> => {
		pendingInvocations.add(pending);
		pending.then(
			() => pendingInvocations.delete(pending),
			() => pendingInvocations.delete(pending),
		);
		return pending;
	};
	const releaseFiber = (fiber: NativeFiberHandle): void => {
		if (!fibers.delete(fiber)) return;
		try {
			reactBridge.release?.(fiber);
		} catch {
			return;
		}
	};
	const disposeSurface = (surface: NativeFabricSurface): void => {
		try {
			const unmountAsync = fabricBridge.unmountAsync;
			if (unmountAsync) {
				void unmountAsync.call(fabricBridge, surface).catch(() => undefined);
				return;
			}
			fabricBridge.unmount(surface);
		} catch {
			return;
		}
	};

	const objc: NativeObjCBridge = {
		getClass: scopeMethod(
			bridge.objc.getClass.bind(bridge.objc),
			capabilityRequirements.getClass,
		) as NativeObjCBridge['getClass'],
		alloc: scopeMethod(
			bridge.objc.alloc.bind(bridge.objc),
			capabilityRequirements.alloc,
		) as NativeObjCBridge['alloc'],
		className: scopeMethod(
			bridge.objc.className.bind(bridge.objc),
			capabilityRequirements.className,
		) as NativeObjCBridge['className'],
		respondsTo: scopeMethod(
			bridge.objc.respondsTo.bind(bridge.objc),
			capabilityRequirements.respondsTo,
		) as NativeObjCBridge['respondsTo'],
		call: scopeMethod(
			bridge.objc.call.bind(bridge.objc),
			capabilityRequirements.call,
		) as NativeObjCBridge['call'],
		callSuper: scopeMethod(
			bridge.objc.callSuper.bind(bridge.objc),
			capabilityRequirements.callSuper,
		) as NativeObjCBridge['callSuper'],
		invoke: scopeMethod(
			bridge.objc.invoke.bind(bridge.objc),
			capabilityRequirements.invoke,
		) as NativeObjCBridge['invoke'],
		invokeAsync: ((handle, selector, args) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.invokeAsync);
			const invoke = bridge.objc.invokeAsync;
			if (!invoke)
				throw new NativePluginUnavailableError('Async native invocation is unavailable.');
			return trackInvocation(invoke.call(bridge.objc, handle, selector, args));
		}) as NativeObjCBridge['invokeAsync'],
		batch: ((steps) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.batch);
			const batch = bridge.objc.batch;
			if (!batch) throw new NativePluginUnavailableError('Native batch is unavailable.');
			return trackInvocation(batch.call(bridge.objc, steps));
		}) as NativeObjCBridge['batch'],
		snapshot: ((root, options) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.snapshot);
			const snapshot = bridge.objc.snapshot;
			if (!snapshot)
				throw new NativePluginUnavailableError('Native UI snapshot is unavailable.');
			return trackInvocation(snapshot.call(bridge.objc, root, options));
		}) as NativeObjCBridge['snapshot'],
		findViews: ((root, className, options) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.findViews);
			const findViews = bridge.objc.findViews;
			if (!findViews)
				throw new NativePluginUnavailableError('Native view search is unavailable.');
			return trackInvocation(findViews.call(bridge.objc, root, className, options));
		}) as NativeObjCBridge['findViews'],
		invokeSuper: scopeMethod(
			bridge.objc.invokeSuper.bind(bridge.objc),
			capabilityRequirements.invokeSuper,
		) as NativeObjCBridge['invokeSuper'],
		invokeSuperAsync: ((handle, currentClass, selector, args) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.invokeSuperAsync);
			const invoke = bridge.objc.invokeSuperAsync;
			if (!invoke)
				throw new NativePluginUnavailableError(
					'Async native super invocation is unavailable.',
				);
			return trackInvocation(invoke.call(bridge.objc, handle, currentClass, selector, args));
		}) as NativeObjCBridge['invokeSuperAsync'],
		getIvar: scopeMethod(
			bridge.objc.getIvar.bind(bridge.objc),
			capabilityRequirements.getIvar,
		) as NativeObjCBridge['getIvar'],
		setIvar: scopeMethod(
			bridge.objc.setIvar.bind(bridge.objc),
			capabilityRequirements.setIvar,
		) as NativeObjCBridge['setIvar'],
		createAssociationKey: scopeMethod(
			bridge.objc.createAssociationKey.bind(bridge.objc),
			capabilityRequirements.createAssociationKey,
		) as NativeObjCBridge['createAssociationKey'],
		getAssociatedObject: scopeMethod(
			bridge.objc.getAssociatedObject.bind(bridge.objc),
			capabilityRequirements.getAssociatedObject,
		) as NativeObjCBridge['getAssociatedObject'],
		setAssociatedObject: ((handle, key, value, policy) => {
			scopeMethod(
				bridge.objc.setAssociatedObject.bind(bridge.objc),
				capabilityRequirements.setAssociatedObject,
			)(handle, key, value, policy);
			const index = associations.findIndex(
				(binding) => binding.handle === handle && binding.key === key,
			);
			if (value === null || value === undefined) {
				if (index !== -1) associations.splice(index, 1);
				return;
			}
			if (index === -1) associations.push({ handle, key });
		}) as NativeObjCBridge['setAssociatedObject'],
		struct: scopeMethod(
			bridge.objc.struct.bind(bridge.objc),
			capabilityRequirements.struct,
		) as NativeObjCBridge['struct'],
		array: scopeMethod(
			bridge.objc.array.bind(bridge.objc),
			capabilityRequirements.array,
		) as NativeObjCBridge['array'],
		data: scopeMethod(
			bridge.objc.data.bind(bridge.objc),
			capabilityRequirements.data,
		) as NativeObjCBridge['data'],
		hook: ((
			className: string,
			selector: string,
			handlers: NativeHookHandlers,
			options?: NativeHookOptions,
		) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.hook);
			const token = bridge.objc.hook(className, selector, handlers, options);
			tokens.add(token);
			return {
				get active() {
					return token.active;
				},
				setReturnValue(self, args, value) {
					if (disposed) throw new NativePluginDisposedError();
					token.setReturnValue(self, args, value);
				},
				removeReturnValue(self, args) {
					if (disposed) throw new NativePluginDisposedError();
					token.removeReturnValue(self, args);
				},
				clearReturnValues() {
					if (disposed) throw new NativePluginDisposedError();
					token.clearReturnValues();
				},
				setSizeHeightFloor(self, args, floor) {
					if (disposed) throw new NativePluginDisposedError();
					token.setSizeHeightFloor(self, args, floor);
				},
				removeSizeHeightFloor(self, args) {
					if (disposed) throw new NativePluginDisposedError();
					token.removeSizeHeightFloor(self, args);
				},
				remove() {
					token.remove();
					tokens.delete(token);
				},
			};
		}) as NativeObjCBridge['hook'],
	};

	const ffi: NativeFFIBridge = {
		symbol: scopeMethod(
			bridge.ffi.symbol.bind(bridge.ffi),
			'native.ffi.symbols',
		) as NativeFFIBridge['symbol'],
		call: scopeMethod(
			bridge.ffi.call.bind(bridge.ffi),
			'native.ffi.call',
		) as NativeFFIBridge['call'],
	};

	const fabric: NativeFabricBridge = {
		mount: ((container, moduleName, properties) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricMount);
			const surface = fabricBridge.mount(container, moduleName, properties);
			surfaces.add(surface);
			return surface;
		}) as NativeFabricBridge['mount'],
		mountAsync: ((container, moduleName, properties) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricMountAsync);
			const mount = fabricBridge.mountAsync;
			if (!mount)
				throw new NativePluginUnavailableError('Async Fabric mounting is unavailable.');
			const pending = trackInvocation(
				mount.call(fabricBridge, container, moduleName, properties),
			);
			pending.then(
				(surface) => {
					if (disposed) disposeSurface(surface);
					else surfaces.add(surface);
				},
				() => undefined,
			);
			return pending;
		}) as NativeFabricBridge['mountAsync'],
		update: scopeMethod(
			fabricBridge.update.bind(fabricBridge),
			capabilityRequirements.fabricUpdate,
		) as NativeFabricBridge['update'],
		updateAsync: ((surface, properties) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricUpdateAsync);
			const update = fabricBridge.updateAsync;
			if (!update)
				throw new NativePluginUnavailableError('Async Fabric updates are unavailable.');
			return trackInvocation(update.call(fabricBridge, surface, properties));
		}) as NativeFabricBridge['updateAsync'],
		setSize: scopeMethod(
			fabricBridge.setSize.bind(fabricBridge),
			capabilityRequirements.fabricSetSize,
		) as NativeFabricBridge['setSize'],
		setSizeAsync: ((surface, minimumSize, maximumSize) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricSetSizeAsync);
			const setSize = fabricBridge.setSizeAsync;
			if (!setSize)
				throw new NativePluginUnavailableError('Async Fabric sizing is unavailable.');
			return trackInvocation(setSize.call(fabricBridge, surface, minimumSize, maximumSize));
		}) as NativeFabricBridge['setSizeAsync'],
		setFrame: scopeMethod(
			fabricBridge.setFrame.bind(fabricBridge),
			capabilityRequirements.fabricSetFrame,
		) as NativeFabricBridge['setFrame'],
		setFrameAsync: ((surface, frame) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricSetFrameAsync);
			const setFrame = fabricBridge.setFrameAsync;
			if (!setFrame)
				throw new NativePluginUnavailableError(
					'Async Fabric frame updates are unavailable.',
				);
			return trackInvocation(setFrame.call(fabricBridge, surface, frame));
		}) as NativeFabricBridge['setFrameAsync'],
		measure: scopeMethod(
			fabricBridge.measure.bind(fabricBridge),
			capabilityRequirements.fabricMeasure,
		) as NativeFabricBridge['measure'],
		measureAsync: ((view) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricMeasureAsync);
			const measure = fabricBridge.measureAsync;
			if (!measure)
				throw new NativePluginUnavailableError('Async Fabric measurement is unavailable.');
			return trackInvocation(measure.call(fabricBridge, view));
		}) as NativeFabricBridge['measureAsync'],
		unmount: ((surface) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricUnmount);
			fabricBridge.unmount(surface);
			surfaces.delete(surface);
		}) as NativeFabricBridge['unmount'],
		unmountAsync: ((surface) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricUnmountAsync);
			const unmount = fabricBridge.unmountAsync;
			if (!unmount)
				throw new NativePluginUnavailableError('Async Fabric unmounting is unavailable.');
			const pending = trackInvocation(unmount.call(fabricBridge, surface));
			pending.then(
				() => surfaces.delete(surface),
				() => undefined,
			);
			return pending;
		}) as NativeFabricBridge['unmountAsync'],
	};

	const react: NativeReactBridge = {
		getFiber(view) {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.reactGetFiber);
			if (
				!bridge.capabilities.includes('native.react.remount') ||
				!reactBridge.isSupported?.()
			)
				throw new NativePluginUnavailableError('React remounting is unavailable.');
			const pending = trackInvocation(reactBridge.getFiber(view));
			pending.then(
				(fiber) => {
					if (!fiber) return;
					if (disposed) {
						fibers.add(fiber);
						releaseFiber(fiber);
						return;
					}
					if (fibers.size >= 256) {
						const oldest = fibers.values().next().value;
						if (oldest) releaseFiber(oldest);
					}
					fibers.add(fiber);
				},
				() => undefined,
			);
			return pending;
		},
		forceRemount(fiber) {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.reactForceRemount);
			if (!fibers.has(fiber)) throw new NativeReactStaleFiberError();
			const existing = pendingRemounts.get(fiber);
			if (existing) return existing;
			const pending = trackInvocation(reactBridge.forceRemount(fiber));
			pendingRemounts.set(fiber, pending);
			pending.then(
				() => {
					pendingRemounts.delete(fiber);
					releaseFiber(fiber);
				},
				() => {
					pendingRemounts.delete(fiber);
					releaseFiber(fiber);
				},
			);
			return pending;
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
			react,
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			for (const pending of pendingInvocations) pending.cancel();
			pendingInvocations.clear();
			pendingRemounts.clear();
			for (const token of tokens) token.remove();
			tokens.clear();
			for (const surface of surfaces) disposeSurface(surface);
			surfaces.clear();
			for (const fiber of fibers) releaseFiber(fiber);
			for (const binding of associations) {
				bridge.objc.setAssociatedObject(binding.handle, binding.key, null, 'assign');
			}
			associations.length = 0;
		},
	};
}

export function validateNativePluginRequirements(
	capabilities: readonly NativePluginCapability[] = [],
	minimumApi?: string,
): void {
	const nativePlugin = getNativePlugin();
	if ((capabilities.length > 0 || minimumApi) && !nativePlugin) requireNativePlugin();
	if (!nativePlugin) return;

	const unknown = capabilities.find(
		(capability) => !nativePlugin.capabilities.includes(capability),
	);
	if (unknown) throw new NativePluginCapabilityError(unknown);
	if (capabilities.includes('native.react.remount')) {
		const react = nativePlugin.react as NativeReactRuntimeBridge | undefined;
		if (!react?.isSupported?.())
			throw new NativePluginUnavailableError('React remounting is unavailable.');
	}
	if (minimumApi && compareVersions(nativePlugin.apiVersion, minimumApi) < 0)
		throw new NativePluginVersionError(minimumApi, nativePlugin.apiVersion);
}

export function createPluginContext(manifest: AddonManifest): PluginContext {
	const capabilities = Object.freeze([...(manifest.capabilities ?? [])]);
	validateNativePluginRequirements(capabilities, manifest.minNativePluginApi);
	const scoped = createScopedNativePlugin(capabilities);
	return {
		manifest: { ...manifest, capabilities: [...capabilities] },
		id: manifest.id,
		capabilities,
		native: scoped.bridge,
		dispose: scoped.dispose,
	};
}
