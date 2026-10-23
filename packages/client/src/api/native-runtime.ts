import type {
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
export type DCDFileManagerConstants = {
	CacheDirPath: string;
	DocumentsDirPath: string;
};

/** The native `DCDFileManager` module surface for reading, writing, and inspecting files. */
export type DCDFileManagerType = {
	readFile(path: string, encoding: DCDFileManagerEncoding): Promise<string>;
	writeFile(
		type: 'documents' | 'cache',
		path: string,
		data: string,
		encoding: DCDFileManagerEncoding,
	): Promise<string>;
	removeFile(type: 'documents' | 'cache', path: string): Promise<boolean>;
	readAsset: UndocumentedNativeMethod;
	getSize: UndocumentedNativeMethod;
	getVideoDimensions: UndocumentedNativeMethod;
	fileExists(path: string): Promise<boolean>;
	saveFileToGallery: UndocumentedNativeMethod;
	getConstants(): DCDFileManagerConstants;
} & DCDFileManagerConstants;

// UNKNOWN: Discord does not document what these native methods resolve to.
type UndocumentedNativeMethod = () => Promise<unknown>;

/** Build and release metadata reported by the native client info module. */
export type BundleInfoType = {
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
};

/** Hardware and OS details reported by the native device module. */
export type DeviceInfoType = {
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
};

/** The native `BundleUpdaterManager` module surface for OTA updates and reloading the bundle. */
export type DCDBundleManagerType = {
	getInitialBundleDownloaded: UndocumentedNativeMethod;
	getInitialOtaUpdateChecked: UndocumentedNativeMethod;
	checkForUpdateAndReload(): void;
	reload(): void;
	getOtaRootPath: UndocumentedNativeMethod;
	getBuildOverrideCookieContents: UndocumentedNativeMethod;
	setBuildOverrideCookieHeader: UndocumentedNativeMethod;
	getManifestInfo: UndocumentedNativeMethod;
	addListener(eventName: string): void;
	removeListeners(count: number): void;
};

/**
 * @description Resolves the first available native module matching any of the given names, checking both `NativeModules` and the `TurboModuleRegistry`.
 * @template T The type of the resolved native module.
 * @param names The candidate native module names to look up, in priority order.
 * @returns The first matching native module.
 */
export function getNativeModule<T>(...names: string[]): T {
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
 * @returns The runtime property map, or an empty object when Hermes internals are unavailable.
 */
export function getRuntimeProperties(): HermesRuntimeProperties {
	const hermes = typeof HermesInternal === 'undefined' ? null : HermesInternal;

	return isHermesInternal(hermes) ? hermes.getRuntimeProperties() : {};
}

type HermesRuntimeProperties = ReturnType<HermesInternalObject['getRuntimeProperties']>;

// React Native types the global `HermesInternal` as `null | {}`.
function isHermesInternal(value: typeof HermesInternal): value is HermesInternalObject {
	return value !== null && 'getRuntimeProperties' in value;
}

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

	if (!nativePlugin) {
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	}

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

function scopedMethod<A extends unknown[], R>(
	method: (...args: A) => R,
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
	isActive: () => boolean = () => true,
): (...args: A) => R {
	return (...args: A) => {
		if (!isActive()) {
			throw new NativePluginDisposedError();
		}

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

		if (difference !== 0) {
			return difference;
		}
	}

	return 0;
}

function unavailableNativePlugin(): NativePluginBridge {
	function unavailableMethod(): never {
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	}

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

type ScopedNativePlugin = {
	bridge: NativePluginBridge;
	dispose: () => void;
};

function createScopedNativePlugin(
	capabilities: readonly NativePluginCapability[],
): ScopedNativePlugin {
	const bridge = getNativePlugin() ?? unavailableNativePlugin();
	const fabricBridge = bridge.fabric ?? unavailableNativePlugin().fabric;
	const tokens = new Set<NativeHookToken>();
	const surfaces = new Set<NativeFabricSurface>();
	const associations: AssociationBinding[] = [];
	let disposed = false;

	function scopeMethod<A extends unknown[], R>(
		method: (...args: A) => R,
		capability: NativePluginCapability,
	) {
		return scopedMethod(method, capabilities, capability, () => !disposed);
	}

	const objc: NativeObjCBridge = {
		getClass: scopeMethod(
			bridge.objc.getClass.bind(bridge.objc),
			capabilityRequirements.getClass,
		),
		alloc: scopeMethod(bridge.objc.alloc.bind(bridge.objc), capabilityRequirements.alloc),
		className: scopeMethod(
			bridge.objc.className.bind(bridge.objc),
			capabilityRequirements.className,
		),
		respondsTo: scopeMethod(
			bridge.objc.respondsTo.bind(bridge.objc),
			capabilityRequirements.respondsTo,
		),
		call: scopeMethod(bridge.objc.call.bind(bridge.objc), capabilityRequirements.call),
		callSuper: scopeMethod(
			bridge.objc.callSuper.bind(bridge.objc),
			capabilityRequirements.callSuper,
		),
		invoke: scopeMethod(bridge.objc.invoke.bind(bridge.objc), capabilityRequirements.invoke),
		invokeSuper: scopeMethod(
			bridge.objc.invokeSuper.bind(bridge.objc),
			capabilityRequirements.invokeSuper,
		),
		getIvar: scopeMethod(bridge.objc.getIvar.bind(bridge.objc), capabilityRequirements.getIvar),
		setIvar: scopeMethod(bridge.objc.setIvar.bind(bridge.objc), capabilityRequirements.setIvar),
		createAssociationKey: scopeMethod(
			bridge.objc.createAssociationKey.bind(bridge.objc),
			capabilityRequirements.createAssociationKey,
		),
		getAssociatedObject: scopeMethod(
			bridge.objc.getAssociatedObject.bind(bridge.objc),
			capabilityRequirements.getAssociatedObject,
		),
		setAssociatedObject: (handle, key, value, policy) => {
			scopeMethod(
				bridge.objc.setAssociatedObject.bind(bridge.objc),
				capabilityRequirements.setAssociatedObject,
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
		struct: scopeMethod(bridge.objc.struct.bind(bridge.objc), capabilityRequirements.struct),
		array: scopeMethod(bridge.objc.array.bind(bridge.objc), capabilityRequirements.array),
		data: scopeMethod(bridge.objc.data.bind(bridge.objc), capabilityRequirements.data),
		hook: (
			className: string,
			selector: string,
			handlers: NativeHookHandlers,
			options?: NativeHookOptions,
		) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, capabilityRequirements.hook);
			const token = bridge.objc.hook(className, selector, handlers, options);

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
		symbol: scopeMethod(bridge.ffi.symbol.bind(bridge.ffi), 'native.ffi.symbols'),
		call: scopeMethod(bridge.ffi.call.bind(bridge.ffi), 'native.ffi.call'),
	};

	const fabric: NativeFabricBridge = {
		mount: (container, moduleName, properties) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, capabilityRequirements.fabricMount);
			const surface = fabricBridge.mount(container, moduleName, properties);

			surfaces.add(surface);

			return surface;
		},
		update: scopeMethod(
			fabricBridge.update.bind(fabricBridge),
			capabilityRequirements.fabricUpdate,
		),
		setSize: scopeMethod(
			fabricBridge.setSize.bind(fabricBridge),
			capabilityRequirements.fabricSetSize,
		),
		setFrame: scopeMethod(
			fabricBridge.setFrame.bind(fabricBridge),
			capabilityRequirements.fabricSetFrame,
		),
		measure: scopeMethod(
			fabricBridge.measure.bind(fabricBridge),
			capabilityRequirements.fabricMeasure,
		),
		unmount: (surface) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, capabilityRequirements.fabricUnmount);
			fabricBridge.unmount(surface);
			surfaces.delete(surface);
		},
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

/**
 * @description Throws unless the native plugin bridge grants every capability and meets the API version.
 * @param capabilities The capabilities the plugin declares.
 * @param minimumApi The lowest native plugin API version the plugin supports.
 */
export function validateNativePluginRequirements(
	capabilities: readonly NativePluginCapability[] = [],
	minimumApi?: string,
): void {
	const nativePlugin = getNativePlugin();

	if ((capabilities.length > 0 || minimumApi) && !nativePlugin) {
		requireNativePlugin();
	}

	if (!nativePlugin) return;

	const unknown = capabilities.find(
		(capability) => !nativePlugin.capabilities.includes(capability),
	);

	if (unknown) {
		throw new NativePluginCapabilityError(unknown);
	}

	if (minimumApi && compareVersions(nativePlugin.apiVersion, minimumApi) < 0) {
		throw new NativePluginVersionError(minimumApi, nativePlugin.apiVersion);
	}
}

/**
 * @description Builds a plugin's context, with a native bridge scoped to its declared capabilities.
 * @param manifest The plugin's manifest.
 * @returns The plugin context; call its `dispose` to release the plugin's native resources.
 */
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
