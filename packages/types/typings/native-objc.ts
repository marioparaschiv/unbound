import type {
	NativeAssociationKey,
	NativeCallOptions,
	NativeCancelablePromise,
	NativeClassHandle,
	NativeHandle,
	NativeObjectHandle,
	NativeStruct,
	NativeStructFields,
	NativeViewSearchOptions,
	NativeViewSnapshotNode,
	NativeViewSnapshotOptions,
} from './native-handles';
import type { NativeUIScopeFactory } from './native-ui';

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

/** What an Objective-C hook handler receives for one call of the hooked method. */
export type NativeHookContext = {
	/** The receiver, borrowed until the handler returns. */
	self: NativeObjectHandle;
	/** The hooked selector's name. */
	selector: string;
	/** The method's explicit arguments, without `self` and `_cmd`, borrowed until the handler returns. */
	args: unknown[];
	/** Runs the original implementation; it works only synchronously on the hook's thread. */
	// UNKNOWN: returns whatever the hooked Objective-C method returns.
	original: (...args: unknown[]) => unknown;
	/** Swaps the object argument at an index of `args` before the original runs; only during a synchronous handler. */
	replaceObjectArgument(index: number, value: NativeObjectHandle | null): void;
};

/** The handlers an Objective-C hook runs around each call; it needs at least one, unless `cacheOnly` is set. */
export type NativeHookHandlers = {
	/** Runs before the original implementation. */
	before?: (context: NativeHookContext) => void | Promise<void>;
	/** Runs after the original implementation. */
	after?: (context: NativeHookContext) => void | Promise<void>;
	/** Runs instead of the original; what it returns becomes the method's result. */
	// UNKNOWN: the replacement returns whatever type the hooked Objective-C method returns.
	replace?: (context: NativeHookContext) => unknown;
};

/** Options for `objc.hook`. */
export type NativeHookOptions = {
	/** Runs no JavaScript and returns values set with `setReturnValue`; needs a scalar or struct return type. */
	cacheOnly?: boolean;
	/** Hooks calls on this object only. */
	instance?: NativeObjectHandle;
	/** Removes the hook after its first call. */
	once?: boolean;
} & NativeCallOptions;

/** An installed Objective-C hook; the plugin scope removes it on dispose. */
export type NativeHookToken = {
	/** False once the hook is removed. */
	readonly active: boolean;
	/** Sets the result a `cacheOnly` hook returns for calls with this receiver and these arguments. */
	// UNKNOWN: `value` is whatever type the hooked Objective-C method returns.
	setReturnValue(self: NativeObjectHandle, args: unknown[], value: unknown): void;
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
	/** Allocates an uninitialized instance, UIKit classes on the main thread; send it an `init` selector next, or use `create`. */
	alloc(classOrName: string | NativeClassHandle): NativeObjectHandle;
	/** Allocates an instance and returns what `initSelector` initializes; throws when that is nil. */
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
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	call(handle: NativeHandle, selector: string, ...args: unknown[]): unknown;
	/** Runs the implementation `currentClass`'s superclass provides, like `super` in Objective-C. */
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	callSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		...args: unknown[]
	): unknown;
	/** Sends a selector on the thread `options.thread` names; `main` blocks, so prefer `invokeAsync` for UI work. */
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	invoke(
		handle: NativeObjectHandle,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): unknown;
	/** Sends a selector on the main thread and resolves with its result. Needs `native.objc.invokeAsync`. */
	invokeAsync(
		handle: NativeObjectHandle,
		selector: string,
		args: unknown[],
	): NativeCancelablePromise<unknown>;
	/** Runs dependent calls in one main-thread pass; a failed step rejects it without undoing earlier steps. */
	batch(steps: readonly NativeBatchStep[]): NativeCancelablePromise<unknown[]>;
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
	// UNKNOWN: returns whatever the Objective-C method returns, bridged to JS.
	invokeSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		args: unknown[],
		options?: NativeCallOptions,
	): unknown;
	/** Runs the superclass implementation on the main thread and resolves with its result. */
	invokeSuperAsync(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		args: unknown[],
	): NativeCancelablePromise<unknown>;
	/** Reads an instance variable by name, such as `_viewModel`. */
	// UNKNOWN: an ivar holds whatever type its Objective-C declaration says.
	getIvar(handle: NativeObjectHandle, name: string): unknown;
	/** Writes an instance variable by name. */
	// UNKNOWN: an ivar holds whatever type its Objective-C declaration says.
	setIvar(handle: NativeObjectHandle, name: string, value: unknown): void;
	/** Creates a key for attaching a value to objects with `setAssociatedObject`. */
	createAssociationKey(): NativeAssociationKey;
	/** Reads the value attached to an object under a key. */
	// UNKNOWN: an association holds any JS or native value the plugin stored.
	getAssociatedObject(handle: NativeObjectHandle, key: NativeAssociationKey): unknown;
	/** Attaches a value to an object; `null` clears it. `policy` is `assign`, `retain`, `copy`, `retainNonatomic` or `copyNonatomic`. */
	// UNKNOWN: an association holds any JS or native value the plugin stores.
	setAssociatedObject(
		handle: NativeObjectHandle,
		key: NativeAssociationKey,
		value: unknown,
		policy?: string,
	): void;
	/** Builds a registered struct, such as `CGRect` or `UIEdgeInsets`, to pass to native calls. */
	struct<T extends NativeStructFields = NativeStructFields>(
		name: string,
		fields: T,
	): NativeStruct<T>;
	/** Converts an `NSArray` handle to a JavaScript array. */
	array(handle: NativeObjectHandle): unknown[];
	/** Copies bytes into a new `NSData` object. */
	data(value: ArrayBuffer | Uint8Array): NativeObjectHandle;
	/** Hooks a method by class and selector; handlers run in registration order, and the scope removes the hook on dispose. */
	hook(
		className: string,
		selector: string,
		handlers: NativeHookHandlers,
		options?: NativeHookOptions,
	): NativeHookToken;
};

/** The `objc` namespace the loader publishes, before the client adds `create` and scopes it to a plugin. */
export type LoaderObjCBridge = Omit<NativeObjCBridge, 'create'> & NativeUIScopeFactory;
