import type {
	Fn,
	NativeAssociationKey,
	NativeFabricBridge,
	NativeFabricSurface,
	NativeFFIBridge,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	NativePlatformBridge,
	NativePluginBridge,
	NativePluginCapability,
	PluginContext,
	PromiseFn,
} from '@unbound-app/types';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { AddonManifest } from '@unbound-app/types/addons';

export type {
	NativeAssociationKey,
	NativeCallOptions,
	NativeClassHandle,
	NativeFabricBridge,
	NativeFabricFrame,
	NativeFabricSize,
	NativeFabricSurface,
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
	NativePluginError,
	NativePluginErrorCode,
	NativePointer,
	NativeStruct,
	NativeThreadPolicy,
	PluginContext,
} from '@unbound-app/types/native';

/** The text encodings accepted by the native `DCDFileManager` read/write operations. */
export type DCDFileManagerEncoding = 'utf-8' | 'utf8' | 'base64';

/** The constant directory paths exposed by the native `DCDFileManager`. */
export interface DCDFileManagerConstants {
	CacheDirPath: string;
	DocumentsDirPath: string;
}

/** The native `DCDFileManager` module surface for reading, writing, and inspecting files. */
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

/** Build and release metadata reported by the native client info module. */
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

/** Hardware and OS details reported by the native device module. */
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

/** The native `BundleUpdaterManager` module surface for OTA updates and reloading the bundle. */
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

/**
 * @description Resolves the first available native module matching any of the given names, checking both `NativeModules` and the `TurboModuleRegistry`.
 * @template T The type of the resolved native module.
 * @param names The candidate native module names to look up, in priority order.
 * @returns The first matching native module.
 */
export function getNativeModule<T = any>(...names: string[]): T {
	return [
		...names.map((n) => NativeModules[n]),
		...names.map((n) => TurboModuleRegistry.get?.(n)),
	].find((x) => x) as T;
}

/** The resolved native client info module, exposing build and release metadata. */
export const BundleInfo: BundleInfoType = getNativeModule(
	'NativeClientInfoModule',
	'InfoDictionaryManager',
	'RTNClientInfoManager',
);
/** The resolved native bundle updater module, used to check for updates and reload the bundle. */
export const BundleManager: DCDBundleManagerType = getNativeModule('BundleUpdaterManager');
/** The resolved native device module, exposing hardware and OS details. */
export const DeviceInfo: DeviceInfoType = getNativeModule('NativeDeviceModule', 'DCDDeviceManager');

/**
 * @description Persists pending settings to storage, then reloads the native bundle.
 */
export async function reload() {
	const { persist } = await import('~/api/storage');
	await persist();

	BundleManager.reload();
}

/**
 * @description Reads Hermes' runtime metadata, such as the bytecode version, GC, and build channel.
 * React Native types the global `HermesInternal` as `null | {}`, so this reads it via
 * `window.HermesInternal` where our own typing wins.
 * @returns The runtime property map, or an empty object when Hermes internals are unavailable.
 */
export function getRuntimeProperties(): Record<string, any> {
	return window.HermesInternal?.getRuntimeProperties() ?? {};
}

type NativeMethod = (...args: any[]) => any;
type NativePluginRuntimeGlobal = typeof globalThis & { NativePlugin?: NativePluginBridge };

type AssociationBinding = {
	handle: NativeObjectHandle;
	key: NativeAssociationKey;
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
	invokeSuper: 'native.objc.invoke',
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
	fabricUpdate: 'native.fabric.mount',
	fabricSetSize: 'native.fabric.mount',
	fabricSetFrame: 'native.fabric.mount',
	fabricMeasure: 'native.fabric.mount',
	fabricUnmount: 'native.fabric.mount',
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

	return {
		apiVersion: '0.0.0',
		abiVersion: '0.0.0',
		capabilities: [],
		objc: unavailableObjC,
		ffi: unavailableFFI,
		fabric: unavailableFabric,
	};
}

function createScopedNativePlugin(capabilities: readonly NativePluginCapability[]): {
	bridge: NativePluginBridge;
	dispose: () => void;
} {
	const bridge = getNativePlugin() ?? unavailableNativePlugin();
	const fabricBridge = bridge.fabric ?? unavailableNativePlugin().fabric;
	const tokens = new Set<NativeHookToken>();
	const surfaces = new Set<NativeFabricSurface>();
	const associations: AssociationBinding[] = [];
	let disposed = false;
	const scopeMethod = (method: NativeMethod, capability: NativePluginCapability): NativeMethod =>
		scopedMethod(method, capabilities, capability, () => !disposed);

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
		invokeSuper: scopeMethod(
			bridge.objc.invokeSuper.bind(bridge.objc),
			capabilityRequirements.invokeSuper,
		) as NativeObjCBridge['invokeSuper'],
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
		update: scopeMethod(
			fabricBridge.update.bind(fabricBridge),
			capabilityRequirements.fabricUpdate,
		) as NativeFabricBridge['update'],
		setSize: scopeMethod(
			fabricBridge.setSize.bind(fabricBridge),
			capabilityRequirements.fabricSetSize,
		) as NativeFabricBridge['setSize'],
		setFrame: scopeMethod(
			fabricBridge.setFrame.bind(fabricBridge),
			capabilityRequirements.fabricSetFrame,
		) as NativeFabricBridge['setFrame'],
		measure: scopeMethod(
			fabricBridge.measure.bind(fabricBridge),
			capabilityRequirements.fabricMeasure,
		) as NativeFabricBridge['measure'],
		unmount: ((surface) => {
			if (disposed) throw new NativePluginDisposedError();
			requireCapability(capabilities, capabilityRequirements.fabricUnmount);
			fabricBridge.unmount(surface);
			surfaces.delete(surface);
		}) as NativeFabricBridge['unmount'],
	};

	return {
		bridge: {
			apiVersion: bridge.apiVersion,
			abiVersion: bridge.abiVersion,
			capabilities: bridge.capabilities,
			objc,
			ffi,
			fabric,
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			for (const token of tokens) token.remove();
			tokens.clear();
			for (const surface of surfaces) fabricBridge.unmount(surface);
			surfaces.clear();
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
	if (minimumApi && compareVersions(nativePlugin.apiVersion, minimumApi) < 0)
		throw new NativePluginVersionError(minimumApi, nativePlugin.apiVersion);
}

export function createPluginContext(manifest: AddonManifest): PluginContext {
	const capabilities = manifest.capabilities ?? [];
	validateNativePluginRequirements(capabilities, manifest.minNativePluginApi);
	const scoped = createScopedNativePlugin(capabilities);
	return {
		manifest,
		id: manifest.id,
		capabilities,
		native: scoped.bridge,
		dispose: scoped.dispose,
	};
}
