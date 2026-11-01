import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { NativeResourceCounts } from '@unbound-app/types';

import { getNativePlugin } from '~/native/plugin-bridge';

/** How the native file manager encodes file contents: UTF-8 text or base64 for binary data. */
export type DCDFileManagerEncoding = 'utf-8' | 'utf8' | 'base64';

/** The constant directory paths exposed by the native `DCDFileManager`. */
export type DCDFileManagerConstants = {
	/** The absolute path to the app's cache directory. */
	CacheDirPath: string;
	/** The absolute path to the app's documents directory, where Unbound keeps its files. */
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

/** A native method Discord exposes without documenting what its promise resolves to. */
// UNKNOWN: Discord does not document what these native methods resolve to.
type UndocumentedNativeMethod = () => Promise<unknown>;

/** Build and release metadata reported by the native client info module. */
export type BundleInfoType = {
	/** Discord's app version, shown in Unbound's settings beside `Build`. */
	Version: string;
	/** The Discord release channel the app was built for. */
	ReleaseChannel: string;
	/** Reported by Discord's native client info module; Unbound does not read it. */
	Manifest: string;
	/** Discord's build number; Unbound's Metro cache is invalidated when it changes. */
	Build: string;
	/** The Sentry DSN Discord reports crashes to. */
	SentryDsn: string;
	/** The device's vendor identifier, which Discord sends in its analytics properties. */
	DeviceVendorID: string;
	/** The build of the over-the-air JavaScript bundle, reported by Discord's native client info module. */
	OTABuild: string;
	/** The Sentry DSN Discord reports crashes to on staff builds. */
	SentryStaffDsn: string;
	/** The app's bundle identifier. */
	Identifier: string;
	/** The Sentry DSN Discord reports crashes to on alpha and beta builds. */
	SentryAlphaBetaDsn: string;
};

/** Hardware and OS details reported by the native device module. */
export type DeviceInfoType = {
	/** Whether the system task bar is shown, as Discord's native device module reports it. */
	isTaskBarEnabled: boolean;
	/** The maximum CPU frequency as a numeric string; empty when unknown. */
	maxCpuFreq: string;
	/** The system-on-chip's name. */
	socName: string;
	/** The device model; `iPad` on an iPad, which Discord checks to detect iPadOS. */
	deviceModel: string;
	/** Whether the device is a tablet. */
	isTablet: boolean;
	/** Whether the system uses gesture navigation instead of navigation buttons. */
	isGestureNavigationEnabled: boolean;
	/** The device's product name, as Discord's native device module reports it. */
	deviceProduct: string;
	/** The operating system version. */
	systemVersion: string;
	/** The device's manufacturer. */
	deviceManufacturer: string;
	/** The device's brand. */
	deviceBrand: string;
	/** The device's RAM size as a numeric string; empty when unknown. */
	ramSize: string;
	/** The device's name, as Discord's native device module reports it. */
	device: string;
};

/** The native `BundleUpdaterManager` module surface for OTA updates and reloading the bundle. */
export type DCDBundleManagerType = {
	/** Reports whether the first OTA bundle has been downloaded; Discord does not document what it resolves to. */
	getInitialBundleDownloaded: UndocumentedNativeMethod;
	/** Reports whether the first OTA update check has run; Discord does not document what it resolves to. */
	getInitialOtaUpdateChecked: UndocumentedNativeMethod;
	/** Checks for an OTA bundle update, then reloads the app. */
	checkForUpdateAndReload(): void;
	/** Reloads the JavaScript bundle; {@link reload} persists settings first, so prefer it. */
	reload(): void;
	/** Reads the directory OTA bundles are stored in; Discord does not document what it resolves to. */
	getOtaRootPath: UndocumentedNativeMethod;
	/** Reads the contents of Discord's build override cookie; Discord does not document what it resolves to. */
	getBuildOverrideCookieContents: UndocumentedNativeMethod;
	/** Sets the build override cookie header; Discord does not document its argument or result. */
	setBuildOverrideCookieHeader: UndocumentedNativeMethod;
	/** Reads the OTA manifest info; Discord does not document what it resolves to. */
	getManifestInfo: UndocumentedNativeMethod;
	/** React Native event-emitter hook: tells the native module a listener for `eventName` was added. */
	addListener(eventName: string): void;
	/** React Native event-emitter hook: tells the native module `count` listeners were removed. */
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

/**
 * @description Reads a native module's constants, which Android TurboModules expose only through `getConstants()`.
 * @param module The resolved module.
 * @returns The module with its constants readable as properties.
 */
export function withNativeConstants<T extends object>(module: T | undefined): T | undefined {
	if (!module || !('getConstants' in module) || typeof module.getConstants !== 'function') {
		return module;
	}

	return { ...module, ...(module.getConstants() as Partial<T>) };
}

/** The resolved native client info module, exposing build and release metadata. */
export const BundleInfo: BundleInfoType = withNativeConstants(
	getNativeModule<BundleInfoType>(
		'NativeClientInfoModule',
		'InfoDictionaryManager',
		'RTNClientInfoManager',
	),
) as BundleInfoType;
/** The resolved native bundle updater module, used to check for updates and reload the bundle. */
export const BundleManager: DCDBundleManagerType = getNativeModule('BundleUpdaterManager');
/** The resolved native device module, exposing hardware and OS details. */
export const DeviceInfo: DeviceInfoType = getNativeModule('NativeDeviceModule', 'DCDDeviceManager');

/**
 * @description Persists pending settings to storage, then reloads the native bundle.
 */
export async function reload() {
	const { persist } = await import('~/storage/api');

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

/**
 * @description Reads how many native resources the loader holds: installed hooks, mounted surfaces, cached hook return values and Java handles still referenced from JavaScript.
 * @returns The counts, or `undefined` when the loader does not report them.
 */
export function getNativeResources(): NativeResourceCounts | undefined {
	try {
		return getNativePlugin()?.debug?.environment().resources;
	} catch {
		return undefined;
	}
}

/** What `HermesInternal.getRuntimeProperties()` reports; empty when the engine is not Hermes. */
type HermesRuntimeProperties = ReturnType<HermesInternalObject['getRuntimeProperties']>;

// React Native types the global `HermesInternal` as `null | {}`.
function isHermesInternal(value: typeof HermesInternal): value is HermesInternalObject {
	return value !== null && 'getRuntimeProperties' in value;
}
