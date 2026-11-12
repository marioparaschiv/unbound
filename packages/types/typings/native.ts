import type { NATIVE_BRIDGE_PLATFORM_CAPABILITIES } from './native-capabilities.gen';
import type { NativeJavaBridge, NativeJavaHooksBridge } from './native-java';
import type { LoaderObjCBridge, NativeObjCBridge } from './native-objc';
import type { NativeUIBridge, NativeUIScopeFactory } from './native-ui';
import type { NativeSerializableObject } from './native-handles';
import type { NativeBridgeCapability } from './native-methods';
import type { NativeFabricBridge } from './native-fabric';
import type { NativeFFIBridge } from './native-ffi';
import type { AddonManifest } from './addons';

export * from './native-capabilities.gen';
export * from './native-platform';
export * from './native-handles';
export * from './native-methods';
export * from './unbound-native';
export * from './native-fabric';
export * from './native-java';
export * from './native-objc';
export * from './native-ffi';
export * from './native-ui';

/** The host platforms a native bridge runs on. */
export const NATIVE_BRIDGE_PLATFORMS = ['ios', 'android'] as const;

/** A host platform the loader reports, `ios` or `android`. */
export type NativeBridgePlatform = (typeof NATIVE_BRIDGE_PLATFORMS)[number];

/** A capability the native bridge on platform `P` provides. */
export type NativeBridgePlatformCapability<P extends NativeBridgePlatform> =
	(typeof NATIVE_BRIDGE_PLATFORM_CAPABILITIES)[P][number];

/** A Discord activity a plugin can subscribe to; the client derives each from Flux actions, such as `MESSAGE_CREATE`. */
export type NativeRuntimeEventName =
	| 'message.created'
	| 'message.updated'
	| 'message.deleted'
	| 'reaction.updated'
	| 'channel.changed'
	| 'composer.changed'
	| 'ui.changed';

/** A runtime event subscription; the plugin scope removes it on dispose. */
export type NativeRuntimeEventToken = {
	/** False once the subscription is removed. */
	readonly active: boolean;
	/** Stops the listener receiving events. */
	remove(): void;
};

/** Delivers Discord activity to plugins. Needs `native.runtime.events`. */
export type NativeRuntimeBridge = {
	/** Calls `listener` with a serializable payload each time the event happens. */
	subscribe(
		event: NativeRuntimeEventName,
		listener: (payload: NativeSerializableObject) => void,
	): NativeRuntimeEventToken;
};

/** One console line an evaluation printed. */
export type NativeDebugEvaluationLog = {
	/** 1 for log, 2 for warn, 3 for error. */
	level: 1 | 2 | 3;
	/** The printed text. */
	message: string;
};

/** One debugger evaluation, which the loader logs and keeps in its evaluation history. */
export type NativeDebugEvaluation = {
	id: string;
	code: string;
	logs?: NativeDebugEvaluationLog[];
} & ({ ok: true; value?: string } | { ok: false; error?: string });

/** How many native resources the loader holds across every plugin. */
export type NativeResourceCounts = {
	/** Installed hooks. */
	hooks: number;
	/** Mounted Fabric surfaces. */
	surfaces: number;
	/** Hook return values set with `setReturnValue`. */
	cachedReturns: number;
	/** Handles still referenced from JavaScript: leases plus the platform's own handle count. */
	handles: number;
	/** Handle leases JavaScript still holds. */
	leases: number;
	/** Live Objective-C value handles; iOS only, 0 elsewhere. */
	objcHandles: number;
	/** Prepared Objective-C call plans; iOS only, 0 elsewhere. */
	objcPlans: number;
	/** Objective-C objects the loader retains internally; iOS only, 0 elsewhere. */
	objcRetains: number;
	/** Java objects with a live handle; Android only, 0 elsewhere. */
	javaHandles: number;
	/** Pooled Fabric surfaces waiting to be reused. */
	idleSurfaces: number;
	/** Fabric surfaces created since launch. */
	createdSurfaces: number;
	/** Fabric surfaces reused from the pool since launch. */
	reusedSurfaces: number;
	/** Batches of main-thread work the loader drained. */
	mainWork: NativeMainWorkCounts;
	/** Main-thread crossings per addon, kind and call label, busiest first. */
	mainWaits: NativeMainWaitCounts[];
};

/** Main-thread drains since launch or the last counter reset. */
export type NativeMainWorkCounts = {
	/** Times the loader drained its main-thread queue. */
	drains: number;
	/** Work items run across every drain. */
	items: number;
	/** Total time spent draining. */
	drainMs: number;
	/** The longest single drain. */
	maxDrainMs: number;
	/** The most items one drain ran. */
	maxDrainItems: number;
};

/** How long main-thread crossings for one addon, kind and call label waited and ran. */
export type NativeMainWaitCounts = {
	/** The id of the addon that made the crossings. */
	addon: string;
	/** How the caller crossed: blocking (`sync`), fire-and-forget (`posted`) or awaiting a promise (`async`). */
	kind: 'sync' | 'posted' | 'async' | 'unknown';
	/** The call label the crossings ran under, `(other)` once the table is full. */
	label: string;
	/** Crossings queued for the main thread. */
	posted: number;
	/** Crossings that began running on the main thread. */
	started: number;
	/** Crossings that finished running on the main thread. */
	finished: number;
	/** Crossings that timed out or were refused before they started. */
	expired: number;
	/** Total time between posting and starting on the main thread. */
	queuedMs: number;
	/** The longest wait between posting and starting. */
	maxQueuedMs: number;
	/** Total time spent running on the main thread. */
	runMs: number;
	/** The longest single run on the main thread. */
	maxRunMs: number;
};

/** What reading the debug environment may do first. */
export type NativeDebugEnvironmentOptions = {
	/** Collects garbage on the calling runtime and the UI runtime before counting. */
	collectGarbage?: boolean;
	/** Zeroes the main-thread counters after reading them. */
	resetCounters?: boolean;
};

/** Which runtimes a debug garbage collection reached. */
export type NativeGarbageCollection = {
	/** Whether garbage was collected on the runtime that made the call. */
	runtime: boolean;
	/** Whether garbage was collected on the UI runtime; false when no UI runtime is registered or collection failed. */
	uiRuntime: boolean;
};

/** Facts about the device a debugger session needs. */
export type NativeDebugEnvironment = {
	/** Whether Discord runs in a simulator, emulator or virtual machine. */
	isVirtualDevice: boolean;
	/** The address of the machine hosting the virtual device, or `null` on a physical one. */
	hostAddress: string | null;
	/** The loader's resource counts. */
	resources: NativeResourceCounts;
	/** Present when the read collected garbage first. */
	garbageCollection?: NativeGarbageCollection;
};

/** Debugger support for plugins. */
export type NativeDebugBridge = {
	/** Logs an evaluation and adds it to the loader's history; false when the record is malformed. Needs `native.debug.evaluations`. */
	recordEvaluation(record: NativeDebugEvaluation): boolean;
	/** Reads the debug environment, optionally collecting garbage or resetting counters first. Needs `native.debug.environment`. */
	environment(options?: NativeDebugEnvironmentOptions): NativeDebugEnvironment;
};

/** The native bridge a plugin reaches through `context.native`, gated by the capabilities it declares. */
export type NativeBridge = {
	/** The version of the JavaScript API plugins use, compared with a manifest's `minNativeBridgeApi`. */
	readonly apiVersion: string;
	/** The version of the native ABI the loader implements. */
	readonly abiVersion: string;
	/** Every capability this loader build provides, not only the ones the plugin declares. */
	readonly capabilities: readonly NativeBridgeCapability[];
	/** The Objective-C runtime; iOS only. */
	readonly objc: NativeObjCBridge;
	/** Raw calls to C functions. */
	readonly ffi: NativeFFIBridge;
	/** React Native surfaces mounted in native views. */
	readonly fabric: NativeFabricBridge;
	/** Subscriptions to Discord activity. */
	readonly runtime: NativeRuntimeBridge;
	/** Java reflection; Android only. */
	readonly java: NativeJavaBridge;
	/** Java method hooks; Android only. */
	readonly hooks: NativeJavaHooksBridge;
	/** Debugger support. */
	readonly debug: NativeDebugBridge;
	/** Worklets on the UI runtime. */
	readonly ui: NativeUIBridge;
};

/** The raw bridge the loader publishes as `globalThis.NativePlugin`; `objc` exists only on iOS, `java` and `hooks` only on Android. */
export type LoaderNativeBridge = Pick<
	NativeBridge,
	'apiVersion' | 'abiVersion' | 'capabilities' | 'ffi' | 'fabric' | 'debug'
> &
	Partial<Pick<NativeBridge, 'hooks'>> & {
		readonly objc?: LoaderObjCBridge;
		readonly java?: NativeJavaBridge & NativeUIScopeFactory;
	};

/** The stable `code` on an error the native bridge or its plugin scope throws. */
export type NativeBridgeErrorCode =
	| 'NATIVE_BRIDGE_ERROR'
	| 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED'
	| 'NATIVE_PLUGIN_CALL_CANCELLED'
	| 'NATIVE_PLUGIN_CALL_TIMEOUT'
	| 'NATIVE_PLUGIN_CAPABILITY_DENIED'
	| 'NATIVE_PLUGIN_SCOPE_DISPOSED'
	| 'NATIVE_PLUGIN_UNAVAILABLE';

/** The shape of an error the native bridge or its plugin scope throws. */
export type NativeBridgeError = {
	/** Which failure it is; native failures without their own code use `NATIVE_BRIDGE_ERROR`. */
	code: NativeBridgeErrorCode;
	/** A human-readable description. */
	message: string;
	/** The capability the plugin lacks, for `NATIVE_PLUGIN_CAPABILITY_DENIED`. */
	capability?: NativeBridgeCapability;
};

/** What the addon manager passes to a plugin's `start`. */
export type PluginContext = {
	/** The plugin's manifest. */
	readonly manifest: AddonManifest;
	/** The plugin's id, from its manifest. */
	readonly id: string;
	/** The host platform, or `undefined` when the loader reports none. */
	readonly platform?: NativeBridgePlatform;
	/** The capabilities the manifest declares for this platform; `native` allows only these. */
	readonly capabilities: readonly NativeBridgeCapability[];
	/** The native bridge, scoped to the plugin's capabilities. */
	readonly native: NativeBridge;
	/** Releases the plugin's hooks, surfaces, handles and subscriptions; the addon manager calls it on stop, unload, reload or a failed start. */
	dispose(): void;
};
