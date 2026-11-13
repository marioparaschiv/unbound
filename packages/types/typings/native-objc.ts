import type {
	NativeAssociationKey,
	NativeCallOptions,
	NativeCancelablePromise,
	NativeClassHandle,
	NativeHandle,
	NativeObjectHandle,
	NativeSerializable,
	NativeStruct,
	NativeStructFields,
	NativeViewSearchOptions,
	NativeViewSnapshotNode,
	NativeViewSnapshotOptions,
} from './native-handles';
import type { NativeUIScopeFactory } from './native-ui';
import type { NativeFFISignature } from './native-ffi';

/** What an Objective-C call returns: a plain value, a handle to an object, a 64-bit integer, or nothing for `void`. */
export type NativeObjCResult = NativeSerializable | NativeHandle | bigint | undefined;

declare const nativeObjCCallPlan: unique symbol;

/** A selector and method signature resolved once by `objc.prepare`, for calling many times without the lookup. */
export type NativeObjCCallPlan = NativeHandle & {
	readonly [nativeObjCCallPlan]: true;
};

/** Refers to an earlier step's result inside `objc.batch`, as a target or an argument. */
export type NativeBatchReference = {
	/** The zero-based index of the earlier step whose result to use. */
	readonly $nativeBatchResult: number;
};

/** One Objective-C call in `objc.batch`; a batch takes up to 64 steps. */
export type NativeBatchStep = {
	/** The object to call, or an earlier step's result. */
	target: NativeObjectHandle | NativeBatchReference;
	/** The selector to send, at most 256 characters. */
	selector: string;
	/** The call's arguments, at most 16; each may be an earlier step's result. */
	args: unknown[];
};

/** Trims what a hook sends to JavaScript per call, to cut crossing cost on hot methods. */
export type NativeHookPayload<Receiver extends boolean = boolean> = {
	/** Whether handlers receive `self`. Defaults to true. */
	receiver?: Receiver;
	/** The zero-based indexes of the arguments to send; every argument when omitted. */
	arguments?: number[];
	/** Sends only the `before` or only the `after` call; both when omitted. */
	phase?: 'before' | 'after';
};

/** What an Objective-C hook handler receives for one call of the hooked method. */
export type NativeHookContext<Receiver extends boolean = true> = {
	/** The receiver, borrowed until the handler returns. */
	self: Receiver extends true ? NativeObjectHandle : undefined;
	/** The hooked selector's name. */
	selector: string;
	/** The method's explicit arguments, without `self` and `_cmd`, borrowed until the handler returns. */
	args: unknown[];
	/** The method argument index each entry of `args` came from, as trimmed by `payload.arguments`. */
	argumentIndexes: number[];
	/** Which handler is running. */
	phase: 'before' | 'after' | 'replace';
	/** Runs the original implementation; it works only synchronously on the hook's thread. */
	original: (...args: unknown[]) => NativeObjCResult;
	/** Swaps the object argument at an index of `args` before the original runs; only during a synchronous handler. */
	replaceObjectArgument(index: number, value: NativeObjectHandle | null): void;
};

/** The handlers an Objective-C hook runs around each call; it needs at least one, unless `cacheOnly` is set. */
export type NativeHookHandlers<Receiver extends boolean = true> = {
	/** Runs before the original implementation. */
	before?: (context: NativeHookContext<Receiver>) => void | Promise<void>;
	/** Runs after the original implementation. */
	after?: (context: NativeHookContext<Receiver>) => void | Promise<void>;
	/** Runs instead of the original; what it returns becomes the method's result. */
	replace?: (context: NativeHookContext<Receiver>) => NativeObjCResult;
};

/** Options for `objc.hook`. */
export type NativeHookOptions<Receiver extends boolean = boolean> = {
	/** Runs no JavaScript and returns values set with `setReturnValue`; needs a scalar or struct return type. */
	cacheOnly?: boolean;
	coalesce?: 'receiver';
	/** Hooks calls on this object only. */
	instance?: NativeObjectHandle;
	/** Removes the hook after its first call. */
	once?: boolean;
	payload?: NativeHookPayload<Receiver>;
	/** Also hooks every loaded subclass that implements the selector itself. */
	subclasses?: boolean;
	/** Waits for a class that is not loaded yet, retrying with backoff for up to ten minutes. */
	waitForClass?: boolean;
} & NativeCallOptions;

/** An installed Objective-C hook; the plugin scope removes it on dispose. */
export type NativeHookToken = {
	/** False once the hook is removed. */
	readonly active: boolean;
	/** Sets the result a `cacheOnly` hook returns for calls with this receiver and these arguments. */
	setReturnValue(self: NativeObjectHandle, args: unknown[], value: NativeObjCResult): void;
	/** Removes the result set for this receiver and these arguments. */
	removeReturnValue(self: NativeObjectHandle, args: unknown[]): void;
	/** Removes every result set on this hook. */
	clearReturnValues(): void;
	/** Removes the hook; calling it again does nothing. */
	remove(): void;
};

/** The iOS bridge to the Objective-C runtime, scoped to the plugin's capabilities. */
export type NativeObjCBridge = {
	/** Looks up a class by name, or returns `null` when none is registered. */
	getClass(name: string): NativeClassHandle | null;
	/** Allocates an instance and initializes it with `init`, UIKit classes on the main thread; use `create` for any other initializer. */
	alloc(classOrName: string | NativeClassHandle): NativeObjectHandle;
	/** Allocates an uninitialized instance, UIKit classes on the main thread unless `options.thread` says otherwise, and returns what `initSelector` initializes; throws when that is nil. */
	create(
		classOrName: string | NativeClassHandle,
		initSelector: string,
		args?: unknown[],
		options?: NativeCallOptions,
	): NativeObjectHandle;
	/** Returns the class name of the object a handle refers to, or `null`. */
	className(handle: NativeHandle): string | null;
	/** Checks whether the object responds to a selector. */
	respondsTo(handle: NativeHandle, selector: string): boolean;
	/** Sends a selector with its arguments on the current runtime thread. */
	call(handle: NativeHandle, selector: string, ...args: unknown[]): NativeObjCResult;
	/** Runs the implementation `currentClass`'s superclass provides, like `super` in Objective-C. */
	callSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		...args: unknown[]
	): NativeObjCResult;
	/** Sends a selector on the thread `options.thread` names; `main` blocks, `main-post` queues `void` methods, so prefer `invokeAsync` or `main-post` for UI work. Ownership follows Cocoa naming: an `alloc`, `new`, `copy`, `mutableCopy` or `init` result is owned by its handle without an extra reference, and the receiver of an `init` selector stays valid. */
	invoke(
		handle: NativeObjectHandle,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): NativeObjCResult;
	/** Sends a selector on the main thread and resolves with its result. Needs `native.objc.invokeAsync`. */
	invokeAsync(
		handle: NativeObjectHandle,
		selector: string,
		args: unknown[],
	): NativeCancelablePromise<NativeObjCResult>;
	/** Resolves a selector's method signature on an object once, for repeated calls through `invokePrepared`. */
	prepare(handle: NativeHandle, selector: string): NativeObjCCallPlan;
	/** Calls a prepared selector on an object, on the thread `options.thread` names, like `invoke`. */
	invokePrepared(
		plan: NativeObjCCallPlan,
		handle: NativeHandle,
		args: unknown[],
		options?: NativeCallOptions,
	): NativeObjCResult;
	/** Calls a prepared selector on the main thread and resolves with its result, like `invokeAsync`. */
	invokePreparedAsync(
		plan: NativeObjCCallPlan,
		handle: NativeHandle,
		args: unknown[],
	): NativeCancelablePromise<NativeObjCResult>;
	/** Frees a call plan; using it afterwards throws. */
	disposePlan(plan: NativeObjCCallPlan): void;
	/** Runs dependent calls in one main-thread pass; a failed step rejects it without undoing earlier steps. */
	batch(steps: readonly NativeBatchStep[]): NativeCancelablePromise<NativeObjCResult[]>;
	/** Reads a `UIView` subtree in one main-thread pass, as a point-in-time list. Needs `native.objc.snapshot`. */
	snapshot(
		root: NativeObjectHandle,
		options?: NativeViewSnapshotOptions,
	): NativeCancelablePromise<NativeViewSnapshotNode[]>;
	/** Finds the views of a class under or above a view on the main thread. Needs `native.objc.snapshot`. */
	findViews(
		root: NativeObjectHandle,
		className: string,
		options?: NativeViewSearchOptions,
	): NativeCancelablePromise<NativeObjectHandle[]>;
	/** Like `callSuper` with a thread policy; it cannot cross to the main thread synchronously. */
	invokeSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): NativeObjCResult;
	/** Runs the superclass implementation on the main thread and resolves with its result. */
	invokeSuperAsync(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		args: unknown[],
	): NativeCancelablePromise<NativeObjCResult>;
	/** Reads an instance variable by name, such as `_viewModel`. */
	getIvar(handle: NativeObjectHandle, name: string): NativeObjCResult;
	/** Writes an instance variable by name. */
	setIvar(handle: NativeObjectHandle, name: string, value: NativeObjCResult): void;
	/** Creates a key for attaching a value to objects with `setAssociatedObject`. */
	createAssociationKey(): NativeAssociationKey;
	/** Reads the value attached to an object under a key. */
	getAssociatedObject(handle: NativeObjectHandle, key: NativeAssociationKey): NativeObjCResult;
	/** Attaches a value to an object; `null` clears it. `policy` is `assign`, `retain`, `copy`, `retainNonatomic` or `copyNonatomic`. */
	setAssociatedObject(
		handle: NativeObjectHandle,
		key: NativeAssociationKey,
		value: NativeObjCResult,
		policy?: string,
	): void;
	/** Builds a registered struct, such as `CGRect` or `UIEdgeInsets`, to pass to native calls. */
	struct<T extends NativeStructFields = NativeStructFields>(
		name: string,
		fields: T,
	): NativeStruct<T>;
	/** Converts an `NSArray` handle to a JavaScript array. */
	array(handle: NativeObjectHandle): NativeObjCResult[];
	/** Copies bytes into a new `NSData` object. */
	data(value: ArrayBuffer | Uint8Array): NativeObjectHandle;
	/** Hooks a method by class and selector; handlers run in registration order, and the scope removes the hook on dispose. */
	hook<Receiver extends boolean = true>(
		className: string,
		selector: string,
		handlers: NativeHookHandlers<Receiver>,
		options?: NativeHookOptions<Receiver>,
	): NativeHookToken;
	/**
	 * Makes an Objective-C block that calls `implementation` on the JavaScript thread, for completion handlers,
	 * notification observers and enumeration blocks. Needs `native.objc.blocks`.
	 */
	block(
		signature: NativeFFISignature,
		implementation: (...args: never[]) => NativeObjCResult | void,
	): NativeObjectHandle;
	/** Calls a block, such as a completion handler a hook received, with an explicit signature. Needs `native.objc.blocks`. */
	callBlock(
		block: NativeObjectHandle,
		signature: NativeFFISignature,
		...args: NativeObjCResult[]
	): NativeObjCResult;
	/** Finds loaded classes by shape, so a lookup survives renamed classes. Needs `native.objc.classSearch`. */
	findClasses(query: NativeObjCClassQuery): string[];
	/**
	 * Defines an Objective-C class at runtime whose methods run JavaScript, for delegates, data sources and
	 * target-action receivers; defining it again replaces its methods. Needs `native.objc.classDefinition`.
	 */
	defineClass(
		name: string,
		superclass: string,
		methods: Record<string, NativeObjCMethodDefinition>,
		protocols?: string[],
	): NativeClassHandle;
};

/** What `objc.findClasses` matches; every given part must match, and names come back sorted. */
export type NativeObjCClassQuery = {
	/** The class name starts with it. */
	prefix?: string;
	/** The path of the image the class is in contains it, such as `Discord.app/Discord`. */
	image?: string;
	/** The class inherits from it, directly or further up. */
	superclass?: string;
	/** The class conforms to every one. */
	protocols?: string[];
	/** The class responds to every instance selector, its own or inherited. */
	methods?: string[];
	/** The class itself implements every instance selector. */
	ownMethods?: string[];
	/** The class responds to every class selector. */
	classMethods?: string[];
	/** At most this many names, 50 by default and 1000 at most. */
	limit?: number;
};

/** One method of a class `objc.defineClass` makes: its signature without `self` and `_cmd`, and what runs. */
export type NativeObjCMethodDefinition = {
	/** The method's argument and return types, without `self` and `_cmd`. */
	signature: NativeFFISignature;
	/** Runs on the JavaScript thread with the receiver and the method's arguments. */
	implementation: (self: NativeObjectHandle, ...args: never[]) => NativeObjCResult | void;
};

/** A kind of a class's own members `objc.inspectMembers` lists. */
export type NativeInspectKind = 'properties' | 'ivars' | 'methods' | 'classMethods' | 'protocols';

/** One class of an inspected class chain, from the class itself to its root. */
export type NativeInspectedClass = {
	/** The class's name. */
	name: string;
	/** The superclass's name, or `null` at the root. */
	superclass: string | null;
	/** The path of the image that defines the class, or `null` when unknown. */
	image: string | null;
	/** The size of an instance, in bytes. */
	instanceSize: number;
	/** How many of each kind of member the class itself declares. */
	counts: Record<NativeInspectKind, number>;
};

/** One member of a class; fields that do not apply to its kind are omitted. */
export type NativeInspectedMember = {
	/** The member's name, or a method's selector. */
	name: string;
	/** The kind of member. */
	kind: NativeInspectKind;
	/** The decoded type, such as `NSString *` or `CGRect`. */
	type?: string;
	/** The declaration, such as `- (void)setFoo:(id)foo`. */
	signature?: string;
	/** A method's decoded return type. */
	returnType?: string;
	/** A method's decoded parameter types, in order. */
	parameters?: string[];
	/** The raw Objective-C type encoding. */
	encoding?: string;
	/** Property attributes, such as `nonatomic`, `strong`, `readonly`, `weak`, `copy` or `class`. */
	attributes?: string[];
	/** A property's getter selector. */
	getter?: string;
	/** A property's setter selector, absent when it is read-only. */
	setter?: string;
	/** The instance variable backing a property. */
	ivar?: string;
	/** An instance variable's offset in the object, in bytes. */
	offset?: number;
	/** An instance variable's size, in bytes. */
	size?: number;
	/** The path of the image that defines a method. */
	image?: string;
	/** Whether reading the value runs no code (`auto`), runs a getter (`manual`), or is unsafe (`never`). */
	read: 'auto' | 'manual' | 'never';
};

/** One value read by `objc.inspectValues`; `text` describes it for display. */
export type NativeInspectedValue = {
	/** The member the value was read from. */
	name: string;
	/** What the value is; `skipped` was not read and `error` failed to read. */
	kind:
		| 'nil'
		| 'number'
		| 'bool'
		| 'string'
		| 'object'
		| 'class'
		| 'struct'
		| 'pointer'
		| 'selector'
		| 'other'
		| 'skipped'
		| 'error';
	/** The value as text, strings cut to 500 characters. */
	text: string;
	/** A handle to the value, for `kind: 'object'`. */
	object?: NativeObjectHandle;
	/** The class of an object or class value. */
	className?: string;
};

/** Narrows a page of inspected members, images or classes. */
export type NativeInspectPage = {
	/** How many matches to skip. */
	offset?: number;
	/** At most 200. */
	limit?: number;
	/** A case-insensitive substring of the name. */
	filter?: string;
};

/** One loaded image that defines Objective-C classes. */
export type NativeInspectedImage = {
	/** The image's path on the device. */
	path: string;
	/** The image's file name. */
	name: string;
	/** How many classes the image defines. */
	classCount: number;
};

/** One page of a class's members of one kind, and how many match in all. */
export type NativeInspectedMembers = {
	/** How many members match in all. */
	total: number;
	/** This page's members. */
	members: NativeInspectedMember[];
};

/** One page of loaded images, and how many match in all. */
export type NativeInspectedImages = {
	/** How many images match in all. */
	total: number;
	/** This page's images. */
	images: NativeInspectedImage[];
};

/** One page of an image's class names, and how many match in all. */
export type NativeInspectedClasses = {
	/** How many classes match in all. */
	total: number;
	/** This page's class names. */
	classes: string[];
};

/** Options for `objc.inspectValues`. */
export type NativeInspectValuesOptions = {
	/** Runs the getters of computed properties, which automatic reads skip. */
	invokeGetters?: boolean;
};

/**
 * The debugger's Objective-C reflection, iOS only and never in a plugin's scope. Needs `native.objc.inspect`.
 * Throws `INSPECTOR_DISABLED` without developer mode or the debugger, `INSPECTOR_UNAVAILABLE` when the library cannot load.
 */
export type NativeObjCInspector = {
	/** Describes a class, or an object's class, and its superclasses; throws `INSPECTOR_UNKNOWN_CLASS` for an unknown name. */
	inspectClass(target: NativeObjectHandle | string): NativeInspectedClass[];
	/** Lists one page of one kind of a class's own members. */
	inspectMembers(
		className: string,
		kind: NativeInspectKind,
		page?: NativeInspectPage,
	): NativeInspectedMembers;
	/** Reads up to 50 properties or ivars of an object on the main thread; getters run only with `invokeGetters`. */
	inspectValues(
		object: NativeObjectHandle,
		className: string,
		kind: 'properties' | 'ivars',
		names: string[],
		options?: NativeInspectValuesOptions,
	): NativeCancelablePromise<NativeInspectedValue[]>;
	/** Lists one page of the loaded images that define Objective-C classes. */
	inspectImages(page?: NativeInspectPage): NativeInspectedImages;
	/** Lists one page of the class names an image defines, sorted. */
	inspectClasses(imagePath: string, page?: NativeInspectPage): NativeInspectedClasses;
};

/** The `objc` namespace the loader publishes, before the client adds `create` and scopes it to a plugin. */
export type LoaderObjCBridge = Omit<NativeObjCBridge, 'create'> &
	Partial<NativeObjCInspector> &
	NativeUIScopeFactory;
