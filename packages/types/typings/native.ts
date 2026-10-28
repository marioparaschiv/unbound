import type * as React from 'react';

import type { AddonManifest, Plugin } from './addons';

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
	'native.ui.lookup',
	'native.ui.mount',
	'native.ui.layout',
] as const;

export type NativePluginCapability = (typeof NATIVE_PLUGIN_CAPABILITIES)[number];

export type NativePluginPlatform = 'ios' | 'android';

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
		'native.ui.layout',
		'native.ui.lookup',
		'native.ui.mount',
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

declare const nativeHandle: unique symbol;

/** An opaque reference to a native object. Only the bridge creates handles; plugins pass them back. */
export type NativeHandle = {
	readonly [nativeHandle]: true;
};

export type NativeClassHandle = NativeHandle;
export type NativeObjectHandle = NativeHandle;
export type NativePointer = NativeHandle;
export type NativeAssociationKey = NativeHandle;

/** A C struct field: a scalar, a pointer or object, or a nested struct. */
export type NativeStructField = number | boolean | NativeHandle | NativeStructFields;

export type NativeStructFields = {
	[field: string]: NativeStructField;
};

export type NativeStruct<T extends NativeStructFields = NativeStructFields> = {
	readonly name: string;
	readonly value?: T;
} & NativeHandle;

/** A value the bridge serializes by structure, such as Fabric surface props or a plist. */
export type NativeSerializable =
	| string
	| number
	| boolean
	| null
	| NativeSerializable[]
	| NativeSerializableObject;

export type NativeSerializableObject = {
	[key: string]: NativeSerializable;
};

export type NativeThreadPolicy = 'current' | 'main';

export type NativeCancelablePromise<T> = Promise<T> & { cancel(): void };

export type NativeBatchReference = {
	readonly $nativeBatchResult: number;
};

export type NativeBatchStep = {
	target: NativeObjectHandle | NativeBatchReference;
	selector: string;
	args: unknown[];
};

export type NativeViewSnapshotOptions = {
	maxDepth?: number;
	maxNodes?: number;
};

export type NativeViewSearchOptions = {
	maxDepth?: number;
	maxVisited?: number;
	maxResults?: number;
	attachedOnly?: boolean;
	stopAtMatch?: boolean;
	direction?: 'ancestors' | 'descendants';
};

export type NativeViewSnapshotNode = {
	view: NativeObjectHandle;
	parent: number;
	depth: number;
	className: string;
	frame: NativeFabricFrame;
	text: string | null;
	visible: boolean;
};

export type NativeCallOptions = {
	thread?: NativeThreadPolicy;
};

export type NativeFFITypeName =
	| 'void'
	| 'bool'
	| 'i8'
	| 'u8'
	| 'i16'
	| 'u16'
	| 'i32'
	| 'u32'
	| 'i64'
	| 'u64'
	| 'float'
	| 'double'
	| 'cstring'
	| 'pointer'
	| 'object'
	| 'class'
	| 'selector';

export type NativeFFIType = NativeFFITypeName | { struct: string };

export type NativeFFISignature = {
	returnType: NativeFFIType;
	args: NativeFFIType[];
};

export type NativeHookContext = {
	self: NativeObjectHandle;
	selector: string;
	args: unknown[];
	// UNKNOWN: returns whatever the hooked Objective-C method returns.
	original: (...args: unknown[]) => unknown;
	replaceObjectArgument(index: number, value: NativeObjectHandle | null): void;
};

export type NativeHookHandlers = {
	before?: (context: NativeHookContext) => void | Promise<void>;
	after?: (context: NativeHookContext) => void | Promise<void>;
	// UNKNOWN: the replacement returns whatever type the hooked Objective-C method returns.
	replace?: (context: NativeHookContext) => unknown;
};

export type NativeHookOptions = {
	cacheOnly?: boolean;
	instance?: NativeObjectHandle;
	once?: boolean;
} & NativeCallOptions;

export type NativeHookToken = {
	readonly active: boolean;
	// UNKNOWN: `value` is whatever type the hooked Objective-C method returns.
	setReturnValue(self: NativeObjectHandle, args: unknown[], value: unknown): void;
	removeReturnValue(self: NativeObjectHandle, args: unknown[]): void;
	clearReturnValues(): void;
	setSizeHeightFloor(self: NativeObjectHandle, args: unknown[], floor: number): void;
	removeSizeHeightFloor(self: NativeObjectHandle, args: unknown[]): void;
	remove(): void;
};

export type NativeObjCBridge = {
	getClass(name: string): NativeClassHandle | null;
	alloc(classOrName: string | NativeClassHandle): NativeObjectHandle;
	className(handle: NativeHandle): string | null;
	respondsTo(handle: NativeHandle, selector: string): boolean;
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	call(handle: NativeHandle, selector: string, ...args: unknown[]): unknown;
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	callSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		...args: unknown[]
	): unknown;
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	invoke(
		handle: NativeObjectHandle,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): unknown;
	invokeAsync(
		handle: NativeObjectHandle,
		selector: string,
		args: unknown[],
	): NativeCancelablePromise<unknown>;
	batch(steps: readonly NativeBatchStep[]): NativeCancelablePromise<unknown[]>;
	snapshot(
		root: NativeObjectHandle,
		options?: NativeViewSnapshotOptions,
	): NativeCancelablePromise<NativeViewSnapshotNode[]>;
	findViews(
		root: NativeObjectHandle,
		className: string,
		options?: NativeViewSearchOptions,
	): NativeCancelablePromise<NativeObjectHandle[]>;
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	invokeSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): unknown;
	invokeSuperAsync(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		args: unknown[],
	): NativeCancelablePromise<unknown>;
	// UNKNOWN: an ivar holds whatever type its Objective-C declaration says.
	getIvar(handle: NativeObjectHandle, name: string): unknown;
	// UNKNOWN: an ivar holds whatever type its Objective-C declaration says.
	setIvar(handle: NativeObjectHandle, name: string, value: unknown): void;
	createAssociationKey(): NativeAssociationKey;
	// UNKNOWN: an association holds any JS or native value the plugin stored.
	getAssociatedObject(handle: NativeObjectHandle, key: NativeAssociationKey): unknown;
	// UNKNOWN: an association holds any JS or native value the plugin stores.
	setAssociatedObject(
		handle: NativeObjectHandle,
		key: NativeAssociationKey,
		value: unknown,
		policy?: string,
	): void;
	struct<T extends NativeStructFields = NativeStructFields>(
		name: string,
		fields: T,
	): NativeStruct<T>;
	array(handle: NativeObjectHandle): unknown[];
	data(value: ArrayBuffer | Uint8Array): NativeObjectHandle;
	hook(
		className: string,
		selector: string,
		handlers: NativeHookHandlers,
		options?: NativeHookOptions,
	): NativeHookToken;
};

export type NativeFFIBridge = {
	symbol(name: string, image?: string): NativePointer | null;
	// UNKNOWN: the result's type is described at runtime by `signature.returnType`.
	call(pointer: NativePointer, signature: NativeFFISignature, ...args: unknown[]): unknown;
};

export type NativeFabricSize = {
	width: number;
	height: number;
};

export type NativeFabricFrame = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type NativeFabricSurface = NativeHandle;

export type NativeFabricBridge = {
	mount(
		container: NativeObjectHandle,
		moduleName: string,
		properties?: NativeSerializableObject,
	): NativeFabricSurface;
	mountAsync(
		container: NativeObjectHandle,
		moduleName: string,
		properties?: NativeSerializableObject,
	): NativeCancelablePromise<NativeFabricSurface>;
	update(surface: NativeFabricSurface, properties: NativeSerializableObject): void;
	updateAsync(
		surface: NativeFabricSurface,
		properties: NativeSerializableObject,
	): NativeCancelablePromise<void>;
	setSize(
		surface: NativeFabricSurface,
		minimumSize: NativeFabricSize,
		maximumSize: NativeFabricSize,
	): void;
	setSizeAsync(
		surface: NativeFabricSurface,
		minimumSize: NativeFabricSize,
		maximumSize: NativeFabricSize,
	): NativeCancelablePromise<void>;
	setFrame(surface: NativeFabricSurface, frame: NativeFabricFrame): void;
	setFrameAsync(
		surface: NativeFabricSurface,
		frame: NativeFabricFrame,
	): NativeCancelablePromise<void>;
	measure(view: NativeObjectHandle): NativeFabricFrame;
	measureAsync(view: NativeObjectHandle): NativeCancelablePromise<NativeFabricFrame>;
	unmount(surface: NativeFabricSurface): void;
	unmountAsync(surface: NativeFabricSurface): NativeCancelablePromise<void>;
};

export type NativeRuntimeEventName =
	| 'message.created'
	| 'message.updated'
	| 'message.deleted'
	| 'reaction.updated'
	| 'channel.changed'
	| 'composer.changed'
	| 'ui.changed';

export type NativeRuntimeEventToken = {
	readonly active: boolean;
	remove(): void;
};

export type NativeRuntimeBridge = {
	subscribe(
		event: NativeRuntimeEventName,
		listener: (payload: NativeSerializableObject) => void,
	): NativeRuntimeEventToken;
};

export type NativeUIHandle = NativeHandle;

export type NativeUIQuery = {
	role: string;
	root?: NativeUIHandle;
	attributes?: NativeSerializableObject;
	maxDepth?: number;
	maxNodes?: number;
	maxResults?: number;
};

export type NativeUISnapshotNode = {
	id: NativeUIHandle;
	parent: NativeUIHandle | null;
	role: string;
	frame: NativeFabricFrame | null;
	attributes: NativeSerializableObject;
};

export type NativeUISnapshot = {
	generation: number;
	nodes: NativeUISnapshotNode[];
};

export type NativeJavaHandle = NativeHandle;

export type NativeJavaValue =
	| { type: 'null'; class?: string }
	| NativeJavaHandleValue
	| { type: 'string'; value: string }
	| { type: 'boolean'; value: boolean }
	| { type: 'byte' | 'short' | 'int' | 'long'; value: number }
	| { type: 'float' | 'double'; value: number }
	| { type: 'char'; value: string }
	| {
			type: 'array';
			componentType: string;
			value: (NativeJavaValue | string | number | boolean)[];
	  };

export type NativeJavaHandleValue = { type: 'handle'; value: string };

export type NativeJavaReference = NativeJavaHandle | NativeJavaHandleValue;

export type NativeJavaArgument = NativeJavaValue | NativeJavaHandle;

export type NativeJavaHookEvent = {
	self: NativeJavaValue;
	args: NativeJavaValue[];
};

export type NativeJavaHookOptions = {
	replace?: boolean;
	notify?: boolean;
};

export type NativeJavaHookToken = {
	readonly id: string;
};

export type NativeJavaHooksBridge = {
	hook(
		className: string,
		methodName: string,
		parameterTypes: string[],
		options?: NativeJavaHookOptions,
		listener?: (event: NativeJavaHookEvent) => void,
	): NativeJavaHookToken;
	setReturnValue(
		token: NativeJavaHookToken,
		self: NativeJavaValue,
		args: NativeJavaValue[],
		value: NativeJavaValue,
	): void;
	removeReturnValue(
		token: NativeJavaHookToken,
		self: NativeJavaValue,
		args: NativeJavaValue[],
	): void;
	clearReturnValues(token: NativeJavaHookToken): void;
	remove(token: NativeJavaHookToken): void;
};

export type NativeJavaBatchOperation = {
	op: 'invoke' | 'getField' | 'setField' | 'respondsTo';
	handle: NativeJavaReference;
	name: string;
	args?: NativeJavaArgument[];
	value?: NativeJavaArgument;
};

export type NativeJavaAssociationKey = NativeHandle;

export type NativeDebugEvaluation = {
	id: string;
	code: string;
	ok: boolean;
	value?: string;
	error?: string;
	logs?: { level: 1 | 2 | 3; message: string }[];
};

export type NativeResourceCounts = {
	hooks: number;
	surfaces: number;
	cachedReturns: number;
	handles: number;
};

export type NativeDebugEnvironment = {
	isVirtualDevice: boolean;
	hostAddress: string | null;
	resources?: NativeResourceCounts;
};

export type NativeDebugBridge = {
	recordEvaluation(record: NativeDebugEvaluation): boolean;
	environment(): NativeDebugEnvironment;
};

export type NativeJavaMethodDescription = {
	name: string;
	parameters: string[];
	returnType: string;
	static: boolean;
};

export type NativeJavaFieldDescription = {
	name: string;
	type: string;
	static: boolean;
};

export type NativeJavaClassDescription = {
	name: string;
	superclass: string | null;
	interfaces: string[];
	constructors: string[][];
	methods: NativeJavaMethodDescription[];
	fields: NativeJavaFieldDescription[];
};

export type NativeJavaBridge = {
	getClass(name: string): NativeJavaHandle;
	describe(name: string): NativeJavaClassDescription;
	batch(operations: NativeJavaBatchOperation[]): NativeJavaValue[];
	createAssociationKey(): NativeJavaAssociationKey;
	getAssociatedObject(
		handle: NativeJavaReference,
		key: NativeJavaAssociationKey,
	): NativeJavaValue;
	setAssociatedObject(
		handle: NativeJavaReference,
		key: NativeJavaAssociationKey,
		value: NativeJavaArgument,
	): void;
	className(handle: NativeJavaReference): NativeJavaValue;
	construct(name: string, args?: NativeJavaArgument[]): NativeJavaHandle;
	respondsTo(
		handle: NativeJavaReference,
		name: string,
		args?: NativeJavaArgument[],
	): NativeJavaValue;
	invoke(handle: NativeJavaReference, name: string, args?: NativeJavaArgument[]): NativeJavaValue;
	invokeAsync(
		handle: NativeJavaReference,
		name: string,
		args?: NativeJavaArgument[],
	): NativeCancelablePromise<NativeJavaValue>;
	getField(handle: NativeJavaReference, name: string): NativeJavaValue;
	setField(handle: NativeJavaReference, name: string, value: NativeJavaArgument): void;
	release(handle: NativeJavaReference): void;
};

export type NativeUIBridge = {
	lookup(query: NativeUIQuery): NativeCancelablePromise<NativeUIHandle[]>;
	snapshot(query: NativeUIQuery): NativeCancelablePromise<NativeUISnapshot>;
	mount(
		container: NativeUIHandle,
		moduleName: string,
		properties?: NativeSerializableObject,
	): NativeCancelablePromise<NativeUIHandle>;
	update(
		handle: NativeUIHandle,
		properties: NativeSerializableObject,
	): NativeCancelablePromise<void>;
	setFrame(handle: NativeUIHandle, frame: NativeFabricFrame): NativeCancelablePromise<void>;
	measure(handle: NativeUIHandle): NativeCancelablePromise<NativeFabricFrame>;
	unmount(handle: NativeUIHandle): NativeCancelablePromise<void>;
};

export type NativePlatformDevice = {
	readonly platform: NativePluginPlatform;
	getDeviceModel(): string;
	getOSVersionString(): string;
	isRooted(): boolean;
	isSystemApp(): boolean;
	isVirtualDevice(): boolean;
};

export type NativePlatformIOSBridge = {
	isVerifiedBuild(): boolean;
	getEntitlements(): NativeSerializableObject;
	getEntitlementsAsPlist(): string;
};

export type NativePlatformApp = {
	getAppSource(): string;
	/** True for the first caller in this process; a reloaded runtime sees false. Missing on older loaders. */
	claimLaunchURL?(): boolean;
};

export type NativePlatformFiles = {
	remove(path: string): boolean;
};

export type NativeCrashPhase = 'starting' | 'running' | 'frozen';

export type NativeCrashedAddon = {
	readonly id: string;
	readonly name: string;
	readonly phase?: NativeCrashPhase;
};

export type NativePlatformCrashGuard = {
	begin(id: string, name: string): boolean;
	end(id: string): boolean;
	disabled(): NativeCrashedAddon[];
	register?(id: string, name: string): number;
	activity?(): ArrayBuffer | undefined;
};

export type NativeSettingsChange =
	| { store: string; key: string; value: NativeSerializable }
	| { store: string; key: string; remove: true }
	| { store: string; clear: true };

export type NativeFontSource = 'app' | 'system' | 'custom';

export type NativeFontEntry = {
	readonly name: string;
	readonly displayName: string;
	readonly family?: string;
	readonly style?: string;
	readonly path?: string;
	readonly source: NativeFontSource;
};

/** The outcome of checking an addon's signature against the keys compiled into the loader. */
export type NativeAddonVerification = {
	readonly status: 'signed' | 'unsigned' | 'invalid';
	readonly signer?: string;
	readonly problem?: string;
};

/** A plugin bundle the loader evaluated from bytecode: it takes the scoped React and returns the plugin module. */
export type NativeCompiledPlugin = (react: typeof React) => Plugin | { default: Plugin };

export type NativePlatformAddons = {
	/** Checks a manifest's `signature` against its bundle. */
	verify(manifest: string, bundle: string): NativeAddonVerification;
	/** Evaluates an installed plugin's bundle compiled for this bytecode version, if its digest matches the manifest. */
	evaluateBytecode?(folder: string, bytecodeVersion: number): NativeCompiledPlugin | undefined;
};

export type NativePlatformFonts = {
	list(): NativeFontEntry[];
};

export type NativePlatformSettings = {
	apply(changes: readonly NativeSettingsChange[]): boolean;
};

export type NativePlatformBridge = {
	readonly platform: NativePluginPlatform;
	// UNKNOWN: returns the completion value of arbitrary evaluated bytecode.
	evaluateBytecode(bytecode: ArrayBuffer, tag?: string): unknown;
	readonly device: NativePlatformDevice;
	readonly app: NativePlatformApp;
	readonly files?: NativePlatformFiles;
	readonly crashGuard?: NativePlatformCrashGuard;
	readonly settings?: NativePlatformSettings;
	readonly fonts?: NativePlatformFonts;
	readonly addons?: NativePlatformAddons;
	readonly ios?: NativePlatformIOSBridge;
};

export type NativePluginBridge = {
	readonly apiVersion: string;
	readonly abiVersion: string;
	readonly capabilities: readonly NativePluginCapability[];
	readonly objc: NativeObjCBridge;
	readonly ffi: NativeFFIBridge;
	readonly fabric: NativeFabricBridge;
	readonly runtime: NativeRuntimeBridge;
	readonly ui: NativeUIBridge;
	readonly java: NativeJavaBridge;
	readonly hooks: NativeJavaHooksBridge;
	readonly debug: NativeDebugBridge;
};

export type NativePluginRuntimeBridge = Pick<
	NativePluginBridge,
	'apiVersion' | 'abiVersion' | 'capabilities'
> &
	Partial<Omit<NativePluginBridge, 'apiVersion' | 'abiVersion' | 'capabilities'>>;

export type NativePluginErrorCode =
	| 'NATIVE_BRIDGE_ERROR'
	| 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED'
	| 'NATIVE_PLUGIN_CAPABILITY_DENIED'
	| 'NATIVE_PLUGIN_SCOPE_DISPOSED'
	| 'NATIVE_PLUGIN_UNAVAILABLE';

export type NativePluginError = {
	code: NativePluginErrorCode;
	message: string;
	capability?: NativePluginCapability;
};

export type PluginContext = {
	readonly manifest: AddonManifest;
	readonly id: string;
	readonly platform?: NativePluginPlatform;
	readonly capabilities: readonly NativePluginCapability[];
	readonly native: NativePluginBridge;
	dispose(): void;
};
