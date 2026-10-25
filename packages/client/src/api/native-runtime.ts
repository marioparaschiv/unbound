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
	NativePlatformBridge,
	NativePluginBridge,
	NativePluginCapability,
	NativePluginPlatform,
	NativePluginRuntimeBridge,
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeRuntimeEventToken,
	NativeSerializableObject,
	NativeUIBridge,
	NativeUIHandle,
	NativeUIQuery,
	NativeUISnapshot,
	NativeUISnapshotNode,
	NativeViewSnapshotNode,
	PluginContext,
} from '@unbound-app/types';
import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { AddonManifest } from '@unbound-app/types/addons';

import { findByPropsLazy } from '~/api/metro/wrappers';

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
	NativePluginPlatform,
	NativePluginError,
	NativePluginErrorCode,
	NativePointer,
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeRuntimeEventToken,
	NativeSerializableObject,
	NativeStruct,
	NativeThreadPolicy,
	NativeUIBridge,
	NativeUIHandle,
	NativeUIQuery,
	NativeUISnapshot,
	PluginContext,
} from '@unbound-app/types/native';

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

type NativePluginRuntimeGlobal = typeof globalThis & { NativePlugin?: NativePluginRuntimeBridge };

type AssociationBinding = {
	handle: NativeObjectHandle;
	key: NativeAssociationKey;
};

const nativePluginGlobal = globalThis as NativePluginRuntimeGlobal;
const nativePluginBridge = nativePluginGlobal.NativePlugin;

delete nativePluginGlobal.NativePlugin;

function getNativePlugin(): NativePluginRuntimeBridge | undefined {
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
	fabricUpdate: 'native.fabric.mount',
	fabricSetSize: 'native.fabric.mount',
	fabricSetFrame: 'native.fabric.mount',
	fabricMeasure: 'native.fabric.mount',
	fabricUnmount: 'native.fabric.mount',
	fabricMountAsync: 'native.fabric.async',
	fabricUpdateAsync: 'native.fabric.async',
	fabricSetSizeAsync: 'native.fabric.async',
	fabricSetFrameAsync: 'native.fabric.async',
	fabricMeasureAsync: 'native.fabric.async',
	fabricUnmountAsync: 'native.fabric.async',
	subscribe: 'native.runtime.events',
};

const nativeUICapabilityRequirements: Record<keyof NativeUIBridge, NativePluginCapability> = {
	lookup: 'native.ui.lookup',
	snapshot: 'native.ui.lookup',
	mount: 'native.ui.mount',
	update: 'native.ui.mount',
	setFrame: 'native.ui.layout',
	measure: 'native.ui.layout',
	unmount: 'native.ui.mount',
};

const nativeJavaCapabilityRequirements: Record<keyof NativeJavaBridge, NativePluginCapability> = {
	getClass: 'native.java.classes',
	className: 'native.java.classes',
	construct: 'native.java.construct',
	respondsTo: 'native.java.classes',
	invoke: 'native.java.invoke',
	invokeAsync: 'native.java.invokeAsync',
	getField: 'native.java.fields',
	setField: 'native.java.fields',
	release: 'native.java.classes',
	batch: 'native.java.batch',
	createAssociationKey: 'native.java.associations',
	getAssociatedObject: 'native.java.associations',
	setAssociatedObject: 'native.java.associations',
};

const nativeDebugCapabilityRequirements: Record<keyof NativeDebugBridge, NativePluginCapability> = {
	recordEvaluation: 'native.debug.evaluations',
	environment: 'native.debug.environment',
};

const nativeHooksCapabilityRequirements: Record<
	keyof NativeJavaHooksBridge,
	NativePluginCapability
> = {
	hook: 'native.java.hooks',
	setReturnValue: 'native.java.hooks',
	removeReturnValue: 'native.java.hooks',
	clearReturnValues: 'native.java.hooks',
	remove: 'native.java.hooks',
};

const iosNativeUICapabilityRequirements: Record<keyof NativeUIBridge, NativePluginCapability> = {
	lookup: 'native.objc.snapshot',
	snapshot: 'native.objc.snapshot',
	mount: 'native.fabric.async',
	update: 'native.fabric.async',
	setFrame: 'native.fabric.async',
	measure: 'native.fabric.async',
	unmount: 'native.fabric.async',
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

export class NativePluginPlatformError extends Error {
	readonly code = 'NATIVE_PLUGIN_PLATFORM_UNSUPPORTED';

	constructor() {
		super('Platform-specific native plugin capabilities require a recognized host platform.');
	}
}

export class NativePluginUnsupportedPlatformError extends Error {
	readonly code = 'NATIVE_PLUGIN_PLATFORM_EXCLUDED';
	readonly platforms: readonly NativePluginPlatform[];

	constructor(platforms: readonly NativePluginPlatform[], platform: string) {
		super(`This plugin supports ${platforms.join(', ')}; the host platform is ${platform}.`);
		this.platforms = platforms;
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

function requireNativePlugin(): NativePluginRuntimeBridge {
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

function unavailableNativePlugin() {
	function unavailableMethod(): never {
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	}

	const unavailableObjC = new Proxy({}, { get: () => unavailableMethod }) as NativeObjCBridge;
	const unavailableFFI = new Proxy({}, { get: () => unavailableMethod }) as NativeFFIBridge;
	const unavailableFabric = new Proxy({}, { get: () => unavailableMethod }) as NativeFabricBridge;
	const unavailableRuntime = new Proxy(
		{},
		{ get: () => unavailableMethod },
	) as NativeRuntimeBridge;
	const unavailableUI = new Proxy({}, { get: () => unavailableMethod }) as NativeUIBridge;
	const unavailableJava = new Proxy({}, { get: () => unavailableMethod }) as NativeJavaBridge;
	const unavailableHooks = new Proxy(
		{},
		{ get: () => unavailableMethod },
	) as NativeJavaHooksBridge;
	const unavailableDebug = new Proxy({}, { get: () => unavailableMethod }) as NativeDebugBridge;

	return {
		apiVersion: '0.0.0',
		abiVersion: '0.0.0',
		capabilities: [],
		objc: unavailableObjC,
		ffi: unavailableFFI,
		fabric: unavailableFabric,
		runtime: unavailableRuntime,
		ui: unavailableUI,
		java: unavailableJava,
		hooks: unavailableHooks,
		debug: unavailableDebug,
	};
}

type FluxMessage = {
	author?: { bot?: boolean; id?: string; username?: string };
	channel_id?: string;
	id?: string;
	nonce?: number | string | null;
};

type FluxEmoji = {
	animated?: boolean;
	id?: string | null;
	name?: string;
};

type FluxRuntimeEvent = {
	channelId?: string;
	channel_id?: string;
	emoji?: FluxEmoji | null;
	guildId?: string;
	guild_id?: string;
	hasDraft?: boolean;
	message?: FluxMessage | null;
	messageId?: string;
	message_id?: string;
	userId?: string;
	user_id?: string;
};

type FluxDispatcher = {
	subscribe?: (event: string, listener: (event: FluxRuntimeEvent) => void) => void;
	unsubscribe?: (event: string, listener: (event: FluxRuntimeEvent) => void) => void;
};

const runtimeEventActions: Record<NativeRuntimeEventName, readonly string[]> = {
	'message.created': ['MESSAGE_CREATE'],
	'message.updated': ['MESSAGE_UPDATE'],
	'message.deleted': ['MESSAGE_DELETE'],
	'reaction.updated': [
		'MESSAGE_REACTION_ADD',
		'MESSAGE_REACTION_REMOVE',
		'MESSAGE_REACTION_REMOVE_ALL',
		'MESSAGE_REACTION_REMOVE_EMOJI',
	],
	'channel.changed': ['CHANNEL_SELECT'],
	'composer.changed': ['DRAFT_CHANGE'],
	'ui.changed': [
		'CHANNEL_SELECT',
		'MESSAGE_CREATE',
		'MESSAGE_UPDATE',
		'MESSAGE_DELETE',
		'MESSAGE_REACTION_ADD',
		'MESSAGE_REACTION_REMOVE',
		'MESSAGE_REACTION_REMOVE_ALL',
		'MESSAGE_REACTION_REMOVE_EMOJI',
	],
};

const fluxDispatcher = findByPropsLazy('dispatch', 'subscribe') as FluxDispatcher;

function createRuntimeEventPayload(
	eventName: NativeRuntimeEventName,
	action: string,
	event: FluxRuntimeEvent,
): NativeSerializableObject {
	const channelId = event.channelId ?? event.channel_id ?? event.message?.channel_id;
	const guildId = event.guildId ?? event.guild_id;
	const messageId = event.messageId ?? event.message_id ?? event.message?.id;
	const userId = event.userId ?? event.user_id;
	const nonce = event.message?.nonce;
	const message: NativeSerializableObject | null = event.message
		? {
				id: event.message.id ?? null,
				channelId: event.message.channel_id ?? null,
				nonce:
					typeof nonce === 'number' && !Number.isFinite(nonce) ? null : (nonce ?? null),
				author: event.message.author
					? {
							id: event.message.author.id ?? null,
							username: event.message.author.username ?? null,
							bot: event.message.author.bot ?? null,
						}
					: null,
			}
		: null;
	const emoji: NativeSerializableObject | null = event.emoji
		? {
				id: event.emoji.id ?? null,
				name: event.emoji.name ?? null,
				animated: event.emoji.animated ?? null,
			}
		: null;

	return {
		event: eventName,
		action,
		channelId: channelId ?? null,
		guildId: guildId ?? null,
		messageId: messageId ?? null,
		userId: userId ?? null,
		hasDraft: typeof event.hasDraft === 'boolean' ? event.hasDraft : null,
		message,
		emoji,
	};
}

function createFluxRuntimeBridge(): NativeRuntimeBridge {
	return {
		subscribe(eventName, listener) {
			const dispatcher = fluxDispatcher;

			if (!dispatcher?.subscribe || !dispatcher.unsubscribe) {
				throw new NativePluginUnavailableError(
					'The Discord runtime event dispatcher is unavailable.',
				);
			}

			let active = true;
			const subscriptions = runtimeEventActions[eventName].map((action) => {
				function callback(event: FluxRuntimeEvent): void {
					if (!active) return;

					try {
						listener(createRuntimeEventPayload(eventName, action, event));
					} catch (error) {
						console.error('Native runtime event listener failed:', error);
					}
				}

				dispatcher.subscribe?.(action, callback);

				return { action, callback };
			});

			return {
				get active() {
					return active;
				},
				remove() {
					if (!active) return;

					active = false;

					for (const { action, callback } of subscriptions) {
						dispatcher.unsubscribe?.(action, callback);
					}
				},
			};
		},
	};
}

type ScopedNativePlugin = {
	bridge: NativePluginBridge;
	dispose: () => void;
};

function mapCancelable<T, U>(source: NativeCancelablePromise<T>, mapper: (value: T) => U) {
	const promise = source.then(mapper);

	return Object.assign(promise, { cancel: () => source.cancel() });
}

function boundedNativeUICount(
	value: number | undefined,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	if (value === undefined) {
		return fallback;
	}

	if (!Number.isInteger(value)) {
		throw new RangeError('Native UI query limits must be integers.');
	}

	return Math.max(minimum, Math.min(value, maximum));
}

function nativeViewRole(className: string): string {
	const separator = className.lastIndexOf('.');
	const simpleClassName = className.slice(separator + 1).toLowerCase();

	if (simpleClassName.includes('button') || simpleClassName.includes('control')) {
		return 'button';
	}

	if (simpleClassName.includes('image')) {
		return 'image';
	}

	if (simpleClassName.includes('text') || simpleClassName.includes('label')) {
		return 'text';
	}

	if (simpleClassName.includes('view') || simpleClassName.includes('container')) {
		return 'container';
	}

	return 'view';
}

function nativeViewAttributes(node: NativeViewSnapshotNode): NativeSerializableObject {
	const separator = node.className.lastIndexOf('.');

	return {
		className: node.className,
		simpleClassName: node.className.slice(separator + 1),
		text: node.text,
		visible: node.visible,
	};
}

function matchesNativeUIQuery(node: NativeUISnapshotNode, query: NativeUIQuery): boolean {
	const className = node.attributes.className;
	const simpleClassName = node.attributes.simpleClassName;

	if (
		query.role !== '*' &&
		query.role !== node.role &&
		query.role !== className &&
		query.role !== simpleClassName
	) {
		return false;
	}

	for (const [key, expected] of Object.entries(query.attributes ?? {})) {
		if (JSON.stringify(node.attributes[key]) !== JSON.stringify(expected)) {
			return false;
		}
	}

	return true;
}

function withFallback<T extends object>(bridge: Partial<T> | undefined, fallback: T): T {
	return new Proxy(fallback, {
		get: (target, property) => {
			const key = property as keyof T;

			return bridge?.[key] ?? target[key];
		},
	});
}

function createIOSNativeUIBridge(
	objc: NativeObjCBridge,
	fabric: NativeFabricBridge,
): NativeUIBridge {
	let generation = 0;

	function snapshot(query: NativeUIQuery): NativeCancelablePromise<NativeUISnapshot> {
		if (!query.root) {
			throw new NativePluginUnavailableError('iOS native UI queries require a root handle.');
		}

		const maxDepth = boundedNativeUICount(query.maxDepth, 8, 0, 12);
		const maxNodes = boundedNativeUICount(query.maxNodes, 100, 1, 256);
		const maxResults = boundedNativeUICount(query.maxResults, 128, 1, 256);
		const currentGeneration = ++generation;
		const captured = objc.snapshot(query.root, { maxDepth, maxNodes });

		return mapCancelable(captured, (views) => ({
			generation: currentGeneration,
			nodes: views
				.map((view) => {
					const parent = view.parent >= 0 ? (views[view.parent]?.view ?? null) : null;

					return {
						id: view.view,
						parent,
						role: nativeViewRole(view.className),
						frame: view.frame,
						attributes: nativeViewAttributes(view),
					};
				})
				.filter((node) => matchesNativeUIQuery(node, query))
				.slice(0, maxResults),
		}));
	}

	return {
		lookup(query) {
			return mapCancelable(snapshot(query), (result) => result.nodes.map((node) => node.id));
		},
		snapshot,
		mount(container, moduleName, properties) {
			if (!container) {
				throw new NativePluginUnavailableError(
					'iOS native UI mounting requires a container.',
				);
			}

			return fabric.mountAsync(container, moduleName, properties);
		},
		update(surface, properties) {
			return fabric.updateAsync(surface, properties);
		},
		setFrame(surface, frame) {
			return fabric.setFrameAsync(surface, frame);
		},
		measure(view) {
			return fabric.measureAsync(view);
		},
		unmount(surface) {
			return fabric.unmountAsync(surface);
		},
	};
}

function createScopedNativePlugin(
	capabilities: readonly NativePluginCapability[],
	platform?: NativePluginPlatform,
): ScopedNativePlugin {
	const fallbackBridge = unavailableNativePlugin();
	const bridge = getNativePlugin() ?? fallbackBridge;
	const objcBridge = bridge.objc ?? fallbackBridge.objc;
	const ffiBridge = bridge.ffi ?? fallbackBridge.ffi;
	const fabricBridge = withFallback(bridge.fabric, fallbackBridge.fabric);
	const runtimeBridge =
		platform === 'android' && capabilities.includes('native.runtime.events')
			? createFluxRuntimeBridge()
			: (bridge.runtime ??
				(capabilities.includes('native.runtime.events')
					? createFluxRuntimeBridge()
					: fallbackBridge.runtime));
	const uiBridge =
		platform === 'ios'
			? createIOSNativeUIBridge(objcBridge, fabricBridge)
			: (bridge.ui ?? fallbackBridge.ui);
	const uiCapabilities =
		platform === 'ios' ? iosNativeUICapabilityRequirements : nativeUICapabilityRequirements;
	const javaBridge = bridge.java ?? fallbackBridge.java;
	const hooksBridge = bridge.hooks ?? fallbackBridge.hooks;
	const debugBridge = bridge.debug ?? fallbackBridge.debug;
	const tokens = new Set<NativeHookToken>();
	const surfaces = new Set<NativeFabricSurface>();
	const uiSurfaces = new Set<NativeUIHandle>();
	const javaHandles = new Set<NativeJavaReference>();
	const javaHookTokens = new Set<NativeJavaHookToken>();
	const runtimeTokens = new Set<NativeRuntimeEventToken>();
	const pendingInvocations = new Set<NativeCancelablePromise<unknown>>();
	const associations: AssociationBinding[] = [];
	let disposed = false;
	const mountAsync = fabricBridge.mountAsync?.bind(fabricBridge);
	const unmountAsync = fabricBridge.unmountAsync?.bind(fabricBridge);
	const unmountUI = uiBridge.unmount?.bind(uiBridge);

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
		getClass: scopeMethod(
			objcBridge.getClass.bind(objcBridge),
			capabilityRequirements.getClass,
		),
		alloc: scopeMethod(objcBridge.alloc.bind(objcBridge), capabilityRequirements.alloc),
		className: scopeMethod(
			objcBridge.className.bind(objcBridge),
			capabilityRequirements.className,
		),
		respondsTo: scopeMethod(
			objcBridge.respondsTo.bind(objcBridge),
			capabilityRequirements.respondsTo,
		),
		call: scopeMethod(objcBridge.call.bind(objcBridge), capabilityRequirements.call),
		callSuper: scopeMethod(
			objcBridge.callSuper.bind(objcBridge),
			capabilityRequirements.callSuper,
		),
		invoke: scopeMethod(objcBridge.invoke.bind(objcBridge), capabilityRequirements.invoke),
		invokeAsync: scopeAsyncMethod(
			objcBridge.invokeAsync?.bind(objcBridge),
			capabilityRequirements.invokeAsync,
			'Async native invocation is unavailable.',
		),
		batch: scopeAsyncMethod(
			objcBridge.batch?.bind(objcBridge),
			capabilityRequirements.batch,
			'Native batch is unavailable.',
		),
		snapshot: scopeAsyncMethod(
			objcBridge.snapshot?.bind(objcBridge),
			capabilityRequirements.snapshot,
			'Native UI snapshot is unavailable.',
		),
		findViews: scopeAsyncMethod(
			objcBridge.findViews?.bind(objcBridge),
			capabilityRequirements.findViews,
			'Native view search is unavailable.',
		),
		invokeSuper: scopeMethod(
			objcBridge.invokeSuper.bind(objcBridge),
			capabilityRequirements.invokeSuper,
		),
		invokeSuperAsync: scopeAsyncMethod(
			objcBridge.invokeSuperAsync?.bind(objcBridge),
			capabilityRequirements.invokeSuperAsync,
			'Async native super invocation is unavailable.',
		),
		getIvar: scopeMethod(objcBridge.getIvar.bind(objcBridge), capabilityRequirements.getIvar),
		setIvar: scopeMethod(objcBridge.setIvar.bind(objcBridge), capabilityRequirements.setIvar),
		createAssociationKey: scopeMethod(
			objcBridge.createAssociationKey.bind(objcBridge),
			capabilityRequirements.createAssociationKey,
		),
		getAssociatedObject: scopeMethod(
			objcBridge.getAssociatedObject.bind(objcBridge),
			capabilityRequirements.getAssociatedObject,
		),
		setAssociatedObject: (handle, key, value, policy) => {
			scopeMethod(
				objcBridge.setAssociatedObject.bind(objcBridge),
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
		struct: scopeMethod(objcBridge.struct.bind(objcBridge), capabilityRequirements.struct),
		array: scopeMethod(objcBridge.array.bind(objcBridge), capabilityRequirements.array),
		data: scopeMethod(objcBridge.data.bind(objcBridge), capabilityRequirements.data),
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
				setSizeHeightFloor(self, args, floor) {
					if (disposed) {
						throw new NativePluginDisposedError();
					}

					token.setSizeHeightFloor(self, args, floor);
				},
				removeSizeHeightFloor(self, args) {
					if (disposed) {
						throw new NativePluginDisposedError();
					}

					token.removeSizeHeightFloor(self, args);
				},
				remove() {
					token.remove();
					tokens.delete(token);
				},
			};
		},
	};

	const ffi: NativeFFIBridge = {
		symbol: scopeMethod(ffiBridge.symbol.bind(ffiBridge), 'native.ffi.symbols'),
		call: scopeMethod(ffiBridge.call.bind(ffiBridge), 'native.ffi.call'),
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
		mountAsync: (container, moduleName, properties) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, capabilityRequirements.fabricMountAsync);

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
		update: scopeMethod(
			fabricBridge.update.bind(fabricBridge),
			capabilityRequirements.fabricUpdate,
		),
		updateAsync: scopeAsyncMethod(
			fabricBridge.updateAsync?.bind(fabricBridge),
			capabilityRequirements.fabricUpdateAsync,
			'Async Fabric updates are unavailable.',
		),
		setSize: scopeMethod(
			fabricBridge.setSize.bind(fabricBridge),
			capabilityRequirements.fabricSetSize,
		),
		setSizeAsync: scopeAsyncMethod(
			fabricBridge.setSizeAsync?.bind(fabricBridge),
			capabilityRequirements.fabricSetSizeAsync,
			'Async Fabric sizing is unavailable.',
		),
		setFrame: scopeMethod(
			fabricBridge.setFrame.bind(fabricBridge),
			capabilityRequirements.fabricSetFrame,
		),
		setFrameAsync: scopeAsyncMethod(
			fabricBridge.setFrameAsync?.bind(fabricBridge),
			capabilityRequirements.fabricSetFrameAsync,
			'Async Fabric frame updates are unavailable.',
		),
		measure: scopeMethod(
			fabricBridge.measure.bind(fabricBridge),
			capabilityRequirements.fabricMeasure,
		),
		measureAsync: scopeAsyncMethod(
			fabricBridge.measureAsync?.bind(fabricBridge),
			capabilityRequirements.fabricMeasureAsync,
			'Async Fabric measurement is unavailable.',
		),
		unmount: (surface) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, capabilityRequirements.fabricUnmount);
			fabricBridge.unmount(surface);
			surfaces.delete(surface);
		},
		unmountAsync: (surface) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, capabilityRequirements.fabricUnmountAsync);

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

			requireCapability(capabilities, capabilityRequirements.subscribe);
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
		javaHandles.add(handle);

		return handle;
	}

	const java: NativeJavaBridge = {
		getClass: (name) =>
			trackJavaHandle(
				scopeMethod(
					javaBridge.getClass.bind(javaBridge),
					nativeJavaCapabilityRequirements.getClass,
				)(name),
			),
		className: scopeMethod(
			javaBridge.className.bind(javaBridge),
			nativeJavaCapabilityRequirements.className,
		),
		construct: (name, args) =>
			trackJavaHandle(
				scopeMethod(
					javaBridge.construct.bind(javaBridge),
					nativeJavaCapabilityRequirements.construct,
				)(name, args ?? []),
			),
		respondsTo: (handle, name, args) =>
			scopeMethod(
				javaBridge.respondsTo.bind(javaBridge),
				nativeJavaCapabilityRequirements.respondsTo,
			)(handle, name, args ?? []),
		invoke: (handle, name, args) =>
			scopeMethod(
				javaBridge.invoke.bind(javaBridge),
				nativeJavaCapabilityRequirements.invoke,
			)(handle, name, args ?? []),
		invokeAsync: (handle, name, args) =>
			scopeAsyncMethod(
				javaBridge.invokeAsync?.bind(javaBridge),
				nativeJavaCapabilityRequirements.invokeAsync,
				'Asynchronous Java invocation is unavailable.',
			)(handle, name, args ?? []),
		getField: scopeMethod(
			javaBridge.getField.bind(javaBridge),
			nativeJavaCapabilityRequirements.getField,
		),
		setField: scopeMethod(
			javaBridge.setField.bind(javaBridge),
			nativeJavaCapabilityRequirements.setField,
		),
		batch: scopeMethod(
			javaBridge.batch.bind(javaBridge),
			nativeJavaCapabilityRequirements.batch,
		),
		createAssociationKey: scopeMethod(
			javaBridge.createAssociationKey.bind(javaBridge),
			nativeJavaCapabilityRequirements.createAssociationKey,
		),
		getAssociatedObject: scopeMethod(
			javaBridge.getAssociatedObject.bind(javaBridge),
			nativeJavaCapabilityRequirements.getAssociatedObject,
		),
		setAssociatedObject: scopeMethod(
			javaBridge.setAssociatedObject.bind(javaBridge),
			nativeJavaCapabilityRequirements.setAssociatedObject,
		),
		release: (handle) => {
			javaHandles.delete(handle);
			scopeMethod(
				javaBridge.release.bind(javaBridge),
				nativeJavaCapabilityRequirements.release,
			)(handle);
		},
	};

	const debug: NativeDebugBridge = {
		recordEvaluation: scopeMethod(
			debugBridge.recordEvaluation.bind(debugBridge),
			nativeDebugCapabilityRequirements.recordEvaluation,
		),
		environment: scopeMethod(
			debugBridge.environment.bind(debugBridge),
			nativeDebugCapabilityRequirements.environment,
		),
	};

	const hooks: NativeJavaHooksBridge = {
		hook: (className, methodName, parameterTypes, options, listener) => {
			const token = scopeMethod(
				hooksBridge.hook.bind(hooksBridge),
				nativeHooksCapabilityRequirements.hook,
			)(className, methodName, parameterTypes, options, listener);

			javaHookTokens.add(token);

			return token;
		},
		setReturnValue: scopeMethod(
			hooksBridge.setReturnValue.bind(hooksBridge),
			nativeHooksCapabilityRequirements.setReturnValue,
		),
		removeReturnValue: scopeMethod(
			hooksBridge.removeReturnValue.bind(hooksBridge),
			nativeHooksCapabilityRequirements.removeReturnValue,
		),
		clearReturnValues: scopeMethod(
			hooksBridge.clearReturnValues.bind(hooksBridge),
			nativeHooksCapabilityRequirements.clearReturnValues,
		),
		remove: (token) => {
			javaHookTokens.delete(token);
			scopeMethod(
				hooksBridge.remove.bind(hooksBridge),
				nativeHooksCapabilityRequirements.remove,
			)(token);
		},
	};

	const ui: NativeUIBridge = {
		lookup: scopeAsyncMethod(
			uiBridge.lookup?.bind(uiBridge),
			uiCapabilities.lookup,
			'Native UI lookup is unavailable.',
		),
		snapshot: scopeAsyncMethod(
			uiBridge.snapshot?.bind(uiBridge),
			uiCapabilities.snapshot,
			'Native UI snapshots are unavailable.',
		),
		mount: (container, moduleName, properties) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, uiCapabilities.mount);
			const pending = trackInvocation(uiBridge.mount(container, moduleName, properties));

			pending.then(
				(handle) => {
					if (disposed) {
						if (unmountUI) {
							void unmountUI(handle).catch(() => undefined);
						}
					} else {
						uiSurfaces.add(handle);
					}
				},
				() => undefined,
			);

			return pending;
		},
		update: scopeAsyncMethod(
			uiBridge.update?.bind(uiBridge),
			uiCapabilities.update,
			'Native UI updates are unavailable.',
		),
		setFrame: scopeAsyncMethod(
			uiBridge.setFrame?.bind(uiBridge),
			uiCapabilities.setFrame,
			'Native UI layout updates are unavailable.',
		),
		measure: scopeAsyncMethod(
			uiBridge.measure?.bind(uiBridge),
			uiCapabilities.measure,
			'Native UI measurement is unavailable.',
		),
		unmount: (handle) => {
			if (disposed) {
				throw new NativePluginDisposedError();
			}

			requireCapability(capabilities, uiCapabilities.unmount);
			const pending = trackInvocation(uiBridge.unmount(handle));

			pending.then(
				() => uiSurfaces.delete(handle),
				() => undefined,
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
			runtime,
			ui,
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

			for (const surface of uiSurfaces) {
				if (unmountUI) {
					void unmountUI(surface).catch(() => undefined);
				}
			}

			uiSurfaces.clear();

			for (const handle of javaHandles) {
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

function resolvePlatformCapabilities(
	platformCapabilities: AddonManifest['platformCapabilities'],
): readonly NativePluginCapability[] {
	const platform = NativePlatform?.device.platform ?? NativePlatform?.platform;
	const entries = Object.entries(platformCapabilities ?? {});
	const invalidPlatform = entries.find(([name]) => name !== 'ios' && name !== 'android');
	const invalidRequirements = entries.find(([, requirements]) => !Array.isArray(requirements));
	const declaredCapabilities = entries.flatMap(([, requirements]) => requirements ?? []);
	const invalidCapability = declaredCapabilities.find(
		(capability) => !NATIVE_PLUGIN_CAPABILITIES.includes(capability),
	);

	if (invalidPlatform) {
		throw new Error(`Unsupported native plugin platform: ${invalidPlatform[0]}`);
	}

	if (invalidRequirements) {
		throw new Error(
			`Native plugin capabilities for ${invalidRequirements[0]} must be an array.`,
		);
	}

	if (invalidCapability) {
		throw new NativePluginCapabilityError(invalidCapability);
	}

	if (entries.length > 0 && platform !== 'ios' && platform !== 'android') {
		throw new NativePluginPlatformError();
	}

	return platform === 'ios' || platform === 'android'
		? (platformCapabilities?.[platform] ?? [])
		: [];
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
	const invalidCapability = capabilities.find(
		(capability) => !NATIVE_PLUGIN_CAPABILITIES.includes(capability),
	);

	if (invalidCapability) {
		throw new NativePluginCapabilityError(invalidCapability);
	}

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
	const platform = NativePlatform?.device.platform ?? NativePlatform?.platform;

	if (manifest.platforms?.length && !manifest.platforms.includes(platform as never)) {
		throw new NativePluginUnsupportedPlatformError(manifest.platforms, String(platform));
	}

	const platformCapabilities = resolvePlatformCapabilities(manifest.platformCapabilities);
	const capabilities = Object.freeze([
		...new Set([...(manifest.capabilities ?? []), ...platformCapabilities]),
	]);

	validateNativePluginRequirements(capabilities, manifest.minNativePluginApi);
	const scoped = createScopedNativePlugin(capabilities, platform);

	return {
		manifest,
		id: manifest.id,
		platform,
		capabilities,
		native: scoped.bridge,
		dispose: scoped.dispose,
	};
}
