import type {
	NativeCancelablePromise,
	NativeHandle,
	NativeViewSearchOptions,
} from './native-handles';
import type { NativeHookPayload } from './native-objc';

/** A handle to a Java object or class; the plugin scope releases it on dispose. */
export type NativeJavaHandle = NativeHandle;

/** A Java value tagged with its type, as the Java bridge returns and accepts it. */
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
			value: (NativeJavaValue | NativeJavaHandle | string | number | boolean)[];
	  };

/** A Java object reference the bridge returns inside a result. */
export type NativeJavaHandleValue = {
	/** Marks the value as an object reference. */
	type: 'handle';
	/** The id the loader issued for the object. */
	value: string;
};

/** A Java object, as a handle or as a tagged handle value from a result. */
export type NativeJavaReference = NativeJavaHandle | NativeJavaHandleValue;

declare const nativeJavaCallPlan: unique symbol;

/** A method resolved once by `java.prepare`, for calling many times without the lookup. */
export type NativeJavaCallPlan = NativeJavaHandle & {
	readonly [nativeJavaCallPlan]: true;
};

/** An argument to a Java call: a tagged value or a handle. */
export type NativeJavaArgument = NativeJavaValue | NativeJavaHandle;

/** What a Java hook listener receives for one call of the hooked method. */
export type NativeJavaHookEvent<Receiver extends boolean = true> = {
	/** The object the hooked method was called on. */
	self: Receiver extends true ? NativeJavaValue : undefined;
	/** The call's arguments. */
	args: NativeJavaValue[];
	/** The method argument index each entry of `args` came from, as trimmed by `payload.arguments`. */
	argumentIndexes: number[];
	/** Whether the listener heard the call before or after the method ran. */
	phase: 'before' | 'after';
};

/** Options for `hooks.hook`. */
export type NativeJavaHookOptions<Receiver extends boolean = boolean> = {
	/** Collapses queued `after` events for the same receiver into one; needs a non-static method and an `after` payload. */
	coalesce?: 'receiver';
	/** Returns a value set with `setReturnValue` for a matching call instead of running the method. Defaults to false. */
	replace?: boolean;
	/** Whether the listener hears calls: before the method by default, `after` once it has run, `false` never. */
	notify?: boolean | 'after';
	/** Lets a `before` listener hooked from a UI scope return `{ arguments }` to run the method with them instead. */
	rewriteArguments?: boolean;
	/** Trims the receiver, arguments and phase each event sends, to cut crossing cost on hot methods. */
	payload?: NativeHookPayload<Receiver>;
};

/** What a `rewriteArguments` listener returns to run the hooked method with other arguments, one per parameter. */
export type NativeJavaHookRewrite = {
	/** The arguments to run the method with, in parameter order. */
	arguments: NativeJavaArgument[];
};

/** What a proxy handler receives for one call of an interface method. */
export type NativeJavaProxyCall = {
	/** The interface method's name, such as `onPreDraw`. */
	method: string;
	/** The call's arguments. */
	args: NativeJavaValue[];
};

/** A Java object implementing interfaces through a handler; remove its token to stop it answering. */
export type NativeJavaProxy = {
	/** Removes the proxy with `hooks.remove`; the UI scope removes it on dispose. */
	token: NativeJavaHookToken;
	/** The object to pass wherever Java expects one of the interfaces. */
	object: NativeJavaHandle;
};

/** An installed Java hook; the plugin scope removes it on dispose. */
export type NativeJavaHookToken = {
	/** The id the loader issued, such as `hook-1`. */
	readonly id: string;
};

/** The Android bridge for hooking Java methods. Needs `native.java.hooks`. */
export type NativeJavaHooksBridge = {
	/** Hooks the method whose parameter class names match `parameterTypes`, and sends each call to `listener`. */
	hook<Receiver extends boolean = true>(
		className: string,
		methodName: string,
		parameterTypes: string[],
		options?: NativeJavaHookOptions<Receiver>,
		listener?: (event: NativeJavaHookEvent<Receiver>) => NativeJavaHookRewrite | void,
	): NativeJavaHookToken;
	/** Sets the result a `replace` hook returns for calls with this receiver and these arguments. */
	setReturnValue(
		token: NativeJavaHookToken,
		self: NativeJavaValue,
		args: NativeJavaValue[],
		value: NativeJavaValue,
	): void;
	/** Removes the result set for this receiver and these arguments. */
	removeReturnValue(
		token: NativeJavaHookToken,
		self: NativeJavaValue,
		args: NativeJavaValue[],
	): void;
	/** Removes every result set on a hook. */
	clearReturnValues(token: NativeJavaHookToken): void;
	/** Removes a hook or a proxy. */
	remove(token: NativeJavaHookToken): void;
	/**
	 * Creates a Java object implementing `interfaces`, from a UI scope only. Calls on the main thread run `handler`
	 * inline and return its value; calls on other threads reach it later and return the type's default.
	 */
	proxy(
		interfaces: string[],
		handler: (call: NativeJavaProxyCall) => NativeJavaArgument | void,
	): NativeJavaProxy;
};

/** One independent operation in a Java `batch` or `batchAsync`. */
export type NativeJavaBatchOperation = {
	/** What to do with `handle`. */
	op: 'invoke' | 'getField' | 'setField' | 'respondsTo';
	/** The object to act on. */
	handle: NativeJavaReference;
	/** The method or field name. */
	name: string;
	/** The method's arguments, for `invoke` and `respondsTo`. */
	args?: NativeJavaArgument[];
	/** The value to write, for `setField`. */
	value?: NativeJavaArgument;
};

/** A key from `java.createAssociationKey` that names one associated value. */
export type NativeJavaAssociationKey = NativeHandle;

/** One method a Java class declares, from `java.describe`. */
export type NativeJavaMethodDescription = {
	/** The method name. */
	name: string;
	/** The parameters' class names, in order, as `hooks.hook` takes them. */
	parameters: string[];
	/** The return type's class name. */
	returnType: string;
	/** Whether the method is static. */
	static: boolean;
};

/** One field a Java class declares, from `java.describe`. */
export type NativeJavaFieldDescription = {
	/** The field name. */
	name: string;
	/** The field type's class name. */
	type: string;
	/** Whether the field is static. */
	static: boolean;
};

/** A Java class's shape, read by reflection with `java.describe`. */
export type NativeJavaClassDescription = {
	/** The fully qualified class name. */
	name: string;
	/** The superclass name, or `null` when there is none. */
	superclass: string | null;
	/** The names of the interfaces the class implements. */
	interfaces: string[];
	/** Each constructor's parameter class names. */
	constructors: string[][];
	/** The methods the class declares. */
	methods: NativeJavaMethodDescription[];
	/** The fields the class declares. */
	fields: NativeJavaFieldDescription[];
};

/** The Android bridge to Java through reflection. Sync calls run on the JavaScript thread, so touch views only asynchronously. */
export type NativeJavaBridge = {
	/** Looks up a class by fully qualified name and returns a handle the scope holds until released. */
	getClass(name: string): NativeJavaHandle;
	/** Lists a class's constructors, methods and fields. */
	describe(name: string): NativeJavaClassDescription;
	/** Runs independent operations in one call on the JavaScript thread and returns every result in order. */
	batch(operations: NativeJavaBatchOperation[]): NativeJavaValue[];
	/** Runs the operations like `batch`, on the main thread, so views can be read safely. */
	batchAsync(operations: NativeJavaBatchOperation[]): NativeCancelablePromise<NativeJavaValue[]>;
	/** Finds the views of a class under or above a view, on the main thread, like `objc.findViews`. */
	findViews(
		root: NativeJavaReference,
		className: string,
		options?: NativeViewSearchOptions,
	): NativeCancelablePromise<NativeJavaValue[]>;
	/** Creates a key for attaching a value to objects with `setAssociatedObject`. */
	createAssociationKey(): NativeJavaAssociationKey;
	/** Reads the value attached to an object under a key. */
	getAssociatedObject(
		handle: NativeJavaReference,
		key: NativeJavaAssociationKey,
	): NativeJavaValue;
	/** Attaches a value to an object under a key. */
	setAssociatedObject(
		handle: NativeJavaReference,
		key: NativeJavaAssociationKey,
		value: NativeJavaArgument,
	): void;
	/** Reads an object's class name, as a string value. */
	className(handle: NativeJavaReference): NativeJavaValue;
	/** Calls the constructor matching `args` and returns a handle the scope holds until released. */
	construct(name: string, args?: NativeJavaArgument[]): NativeJavaHandle;
	/** Checks whether the object has a method `name` callable with `args`, as a boolean value. */
	respondsTo(
		handle: NativeJavaReference,
		name: string,
		args?: NativeJavaArgument[],
	): NativeJavaValue;
	/** Calls a method on the JavaScript thread. */
	invoke(handle: NativeJavaReference, name: string, args?: NativeJavaArgument[]): NativeJavaValue;
	/** Resolves a method by name and parameter types once, for repeated calls through `invokePrepared`. */
	prepare(
		target: NativeJavaReference,
		name: string,
		parameterTypes: readonly string[],
	): NativeJavaCallPlan;
	/** Calls a prepared method on the JavaScript thread, like `invoke`. */
	invokePrepared(
		plan: NativeJavaCallPlan,
		target: NativeJavaReference,
		args?: NativeJavaArgument[],
	): NativeJavaValue;
	/** Calls a prepared method on the main thread and resolves with its result, like `invokeAsync`. */
	invokePreparedAsync(
		plan: NativeJavaCallPlan,
		target: NativeJavaReference,
		args?: NativeJavaArgument[],
	): NativeCancelablePromise<NativeJavaValue>;
	/** Frees a call plan; using it afterwards throws. */
	disposePlan(plan: NativeJavaCallPlan): void;
	/** Calls a method on the main thread and resolves with its result. Needs `native.java.invokeAsync`. */
	invokeAsync(
		handle: NativeJavaReference,
		name: string,
		args?: NativeJavaArgument[],
	): NativeCancelablePromise<NativeJavaValue>;
	/** Reads a field by name. */
	getField(handle: NativeJavaReference, name: string): NativeJavaValue;
	/** Writes a field by name. */
	setField(handle: NativeJavaReference, name: string, value: NativeJavaArgument): void;
	/** Drops the plugin's hold on a handle so the loader can free the object. */
	release(handle: NativeJavaReference): void;
};
