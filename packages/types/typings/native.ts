import type { NativeJavaBridge, NativeJavaHooksBridge } from './native-java';
import type { LoaderObjCBridge, NativeObjCBridge } from './native-objc';
import type { NativeUIBridge, NativeUIScopeFactory } from './native-ui';
import type { NativeSerializableObject } from './native-handles';
import type { NativeFabricBridge } from './native-fabric';
import type { NativeFFIBridge } from './native-ffi';
import type { AddonManifest } from './addons';

export * from './native-platform';
export * from './native-handles';
export * from './native-methods';
export * from './native-fabric';
export * from './native-java';
export * from './native-objc';
export * from './native-ffi';
export * from './native-ui';

/** Every capability name a manifest may declare; an unknown name fails manifest validation. */
export const NATIVE_PLUGIN_CAPABILITIES = [
	'native.objc.classes',
	'native.objc.invoke',
	'native.objc.invokeAsync',
	'native.objc.batch',
	'native.objc.snapshot',
	'native.objc.ivars',
	'native.objc.associations',
	'native.objc.hooks',
	'native.ffi.symbols',
	'native.ffi.call',
	'native.fabric.mount',
	'native.fabric.async',
	'native.runtime.events',
	'native.java.classes',
	'native.java.construct',
	'native.java.fields',
	'native.java.invoke',
	'native.java.invokeAsync',
	'native.java.hooks',
	'native.java.batch',
	'native.java.associations',
	'native.debug.evaluations',
	'native.debug.environment',
] as const;

/** A named permission to use one part of the native bridge, declared in an addon's manifest. */
export type NativePluginCapability = (typeof NATIVE_PLUGIN_CAPABILITIES)[number];

/** The host platforms a native bridge runs on. */
export const NATIVE_PLUGIN_PLATFORMS = ['ios', 'android'] as const;

/** A host platform the loader reports, `ios` or `android`. */
export type NativePluginPlatform = (typeof NATIVE_PLUGIN_PLATFORMS)[number];

/** The capabilities each platform's loader offers; Objective-C ones are iOS only and Java ones Android only. */
export const NATIVE_PLUGIN_PLATFORM_CAPABILITIES = {
	android: [
		'native.java.classes',
		'native.java.construct',
		'native.java.fields',
		'native.java.invoke',
		'native.fabric.async',
		'native.ffi.call',
		'native.ffi.symbols',
		'native.java.associations',
		'native.java.batch',
		'native.java.hooks',
		'native.java.invokeAsync',
		'native.runtime.events',
		'native.debug.environment',
		'native.debug.evaluations',
	],
	ios: [
		'native.fabric.async',
		'native.fabric.mount',
		'native.ffi.call',
		'native.ffi.symbols',
		'native.objc.associations',
		'native.objc.batch',
		'native.objc.classes',
		'native.objc.hooks',
		'native.objc.invoke',
		'native.objc.invokeAsync',
		'native.objc.ivars',
		'native.objc.snapshot',
		'native.debug.environment',
		'native.debug.evaluations',
		'native.runtime.events',
	],
} as const satisfies Record<NativePluginPlatform, readonly NativePluginCapability[]>;

/** A capability the native bridge on platform `P` provides. */
export type NativePluginPlatformCapability<P extends NativePluginPlatform> =
	(typeof NATIVE_PLUGIN_PLATFORM_CAPABILITIES)[P][number];

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
	/** Java handles still referenced from JavaScript. */
	handles: number;
};

/** Facts about the device a debugger session needs. */
export type NativeDebugEnvironment = {
	/** Whether Discord runs in a simulator, emulator or virtual machine. */
	isVirtualDevice: boolean;
	/** The address of the machine hosting the virtual device, or `null` on a physical one. */
	hostAddress: string | null;
	/** The loader's resource counts; missing on older loaders. */
	resources?: NativeResourceCounts;
};

/** Debugger support for plugins. */
export type NativeDebugBridge = {
	/** Logs an evaluation and adds it to the loader's history; false when the record is malformed. Needs `native.debug.evaluations`. */
	recordEvaluation(record: NativeDebugEvaluation): boolean;
	/** Reads the debug environment. Needs `native.debug.environment`. */
	environment(): NativeDebugEnvironment;
};

/** The native bridge a plugin reaches through `context.native`, gated by the capabilities it declares. */
export type NativePluginBridge = {
	/** The version of the JavaScript API plugins use, compared with a manifest's `minNativePluginApi`. */
	readonly apiVersion: string;
	/** The version of the native ABI the loader implements. */
	readonly abiVersion: string;
	/** Every capability this loader build provides, not only the ones the plugin declares. */
	readonly capabilities: readonly NativePluginCapability[];
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

/** The raw bridge the loader publishes as `globalThis.NativePlugin`; namespaces an older loader lacks are missing. */
export type NativePluginRuntimeBridge = Pick<
	NativePluginBridge,
	'apiVersion' | 'abiVersion' | 'capabilities'
> &
	Partial<
		Omit<
			NativePluginBridge,
			'apiVersion' | 'abiVersion' | 'capabilities' | 'objc' | 'java' | 'ui'
		>
	> & {
		readonly objc?: LoaderObjCBridge;
		readonly java?: NativeJavaBridge & NativeUIScopeFactory;
	};

/** The stable `code` on an error the native bridge or its plugin scope throws. */
export type NativePluginErrorCode =
	| 'NATIVE_BRIDGE_ERROR'
	| 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED'
	| 'NATIVE_PLUGIN_CAPABILITY_DENIED'
	| 'NATIVE_PLUGIN_SCOPE_DISPOSED'
	| 'NATIVE_PLUGIN_UNAVAILABLE';

/** The shape of an error the native bridge or its plugin scope throws. */
export type NativePluginError = {
	/** Which failure it is; native failures without their own code use `NATIVE_BRIDGE_ERROR`. */
	code: NativePluginErrorCode;
	/** A human-readable description. */
	message: string;
	/** The capability the plugin lacks, for `NATIVE_PLUGIN_CAPABILITY_DENIED`. */
	capability?: NativePluginCapability;
};

/** What the addon manager passes to a plugin's `start`. */
export type PluginContext = {
	/** The plugin's manifest. */
	readonly manifest: AddonManifest;
	/** The plugin's id, from its manifest. */
	readonly id: string;
	/** The host platform, or `undefined` when the loader reports none. */
	readonly platform?: NativePluginPlatform;
	/** The capabilities the manifest declares for this platform; `native` allows only these. */
	readonly capabilities: readonly NativePluginCapability[];
	/** The native bridge, scoped to the plugin's capabilities. */
	readonly native: NativePluginBridge;
	/** Releases the plugin's hooks, surfaces, handles and subscriptions; the addon manager calls it on stop, unload, reload or a failed start. */
	dispose(): void;
};
