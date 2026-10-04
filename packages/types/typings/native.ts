import type { AddonManifest } from './addons';

export type NativePluginCapability =
	| 'native.objc.classes'
	| 'native.objc.invoke'
	| 'native.objc.ivars'
	| 'native.objc.associations'
	| 'native.objc.hooks'
	| 'native.ffi.symbols'
	| 'native.ffi.call'
	| 'native.fabric.mount';

export type NativeHandle = object;

export type NativeClassHandle = NativeHandle;
export type NativeObjectHandle = NativeHandle;
export type NativePointer = NativeHandle;
export type NativeAssociationKey = NativeHandle;

export interface NativeStruct<T extends object = Record<string, unknown>> extends NativeHandle {
	readonly name: string;
	readonly value?: T;
}

export type NativeThreadPolicy = 'current' | 'main';

export interface NativeCallOptions {
	thread?: NativeThreadPolicy;
}

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

export interface NativeFFISignature {
	returnType: NativeFFIType;
	args: NativeFFIType[];
}

export interface NativeHookContext {
	self: NativeObjectHandle;
	selector: string;
	args: unknown[];
	original: (...args: unknown[]) => unknown;
	replaceObjectArgument(index: number, value: NativeObjectHandle | null): void;
}

export interface NativeHookHandlers {
	before?: (context: NativeHookContext) => void | Promise<void>;
	after?: (context: NativeHookContext) => void | Promise<void>;
	replace?: (context: NativeHookContext) => unknown;
}

export interface NativeHookOptions extends NativeCallOptions {
	cacheOnly?: boolean;
	instance?: NativeObjectHandle;
	once?: boolean;
}

export interface NativeHookToken {
	readonly active: boolean;
	setReturnValue(self: NativeObjectHandle, args: unknown[], value: unknown): void;
	removeReturnValue(self: NativeObjectHandle, args: unknown[]): void;
	clearReturnValues(): void;
	remove(): void;
}

export interface NativeObjCBridge {
	getClass(name: string): NativeClassHandle | null;
	alloc(classOrName: string | NativeClassHandle): NativeObjectHandle;
	className(handle: NativeHandle): string | null;
	respondsTo(handle: NativeHandle, selector: string): boolean;
	call(handle: NativeHandle, selector: string, ...args: unknown[]): unknown;
	callSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		...args: unknown[]
	): unknown;
	invoke(
		handle: NativeObjectHandle,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): unknown;
	invokeSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): unknown;
	getIvar(handle: NativeObjectHandle, name: string): unknown;
	setIvar(handle: NativeObjectHandle, name: string, value: unknown): void;
	createAssociationKey(): NativeAssociationKey;
	getAssociatedObject(handle: NativeObjectHandle, key: NativeAssociationKey): unknown;
	setAssociatedObject(
		handle: NativeObjectHandle,
		key: NativeAssociationKey,
		value: unknown,
		policy?: string,
	): void;
	struct<T extends object = Record<string, unknown>>(name: string, fields: T): NativeStruct<T>;
	array(handle: NativeObjectHandle): unknown[];
	data(value: ArrayBuffer | Uint8Array): NativeObjectHandle;
	hook(
		className: string,
		selector: string,
		handlers: NativeHookHandlers,
		options?: NativeHookOptions,
	): NativeHookToken;
}

export interface NativeFFIBridge {
	symbol(name: string, image?: string): NativePointer | null;
	call(pointer: NativePointer, signature: NativeFFISignature, ...args: unknown[]): unknown;
}

export interface NativeFabricSize {
	width: number;
	height: number;
}

export interface NativeFabricFrame {
	x: number;
	y: number;
	width: number;
	height: number;
}

export type NativeFabricSurface = NativeHandle;

export interface NativeFabricBridge {
	mount(
		container: NativeObjectHandle,
		moduleName: string,
		properties?: Record<string, unknown>,
	): NativeFabricSurface;
	update(surface: NativeFabricSurface, properties: Record<string, unknown>): void;
	setSize(
		surface: NativeFabricSurface,
		minimumSize: NativeFabricSize,
		maximumSize: NativeFabricSize,
	): void;
	setFrame(surface: NativeFabricSurface, frame: NativeFabricFrame): void;
	measure(view: NativeObjectHandle): NativeFabricFrame;
	unmount(surface: NativeFabricSurface): void;
}

export interface NativePlatformDevice {
	getDeviceModel(): string;
	getiOSVersionString(): string;
	isJailbroken(): boolean;
	isSystemApp(): boolean;
	isVerifiedBuild(): boolean;
	getEntitlements(): Record<string, any>;
	getEntitlementsAsPlist(): string;
}

export interface NativePlatformApp {
	getAppSource(): string;
}

export interface NativePlatformBridge {
	evaluateBytecode(bytecode: ArrayBuffer, tag?: string): unknown;
	readonly device: NativePlatformDevice;
	readonly app: NativePlatformApp;
}

export interface NativePluginBridge {
	readonly apiVersion: string;
	readonly abiVersion: string;
	readonly capabilities: readonly NativePluginCapability[];
	readonly objc: NativeObjCBridge;
	readonly ffi: NativeFFIBridge;
	readonly fabric: NativeFabricBridge;
}

export type NativePluginErrorCode =
	| 'NATIVE_BRIDGE_ERROR'
	| 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED'
	| 'NATIVE_PLUGIN_CAPABILITY_DENIED'
	| 'NATIVE_PLUGIN_SCOPE_DISPOSED'
	| 'NATIVE_PLUGIN_UNAVAILABLE';

export interface NativePluginError {
	code: NativePluginErrorCode;
	message: string;
	capability?: NativePluginCapability;
}

export interface PluginContext {
	readonly manifest: AddonManifest;
	readonly id: string;
	readonly capabilities: readonly NativePluginCapability[];
	readonly native: NativePluginBridge;
	dispose(): void;
}
