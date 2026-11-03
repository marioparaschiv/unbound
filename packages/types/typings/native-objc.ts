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

export type NativeObjCResult = NativeSerializable | NativeHandle | bigint | undefined;

declare const nativeObjCCallPlan: unique symbol;

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

export type NativeHookPayload<Receiver extends boolean = boolean> = {
	receiver?: Receiver;
	arguments?: number[];
	phase?: 'before' | 'after';
};

export type NativeHookContext<Receiver extends boolean = true> = {
	/** The receiver, borrowed until the handler returns. */
	self: Receiver extends true ? NativeObjectHandle : undefined;
	/** The hooked selector's name. */
	selector: string;
	/** The method's explicit arguments, without `self` and `_cmd`, borrowed until the handler returns. */
	args: unknown[];
	argumentIndexes: number[];
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
	call(handle: NativeHandle, selector: string, ...args: unknown[]): NativeObjCResult;
	/** Runs the implementation `currentClass`'s superclass provides, like `super` in Objective-C. */
	callSuper(
		handle: NativeObjectHandle,
		currentClass: NativeClassHandle | string,
		selector: string,
		...args: unknown[]
	): NativeObjCResult;
	/** Sends a selector on the thread `options.thread` names; `main` blocks, `main-post` queues `void` methods, so prefer `invokeAsync` or `main-post` for UI work. */
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
	prepare(handle: NativeHandle, selector: string): NativeObjCCallPlan;
	invokePrepared(
		plan: NativeObjCCallPlan,
		handle: NativeHandle,
		args: unknown[],
		options?: NativeCallOptions,
	): NativeObjCResult;
	invokePreparedAsync(
		plan: NativeObjCCallPlan,
		handle: NativeHandle,
		args: unknown[],
	): NativeCancelablePromise<NativeObjCResult>;
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
};

/** The `objc` namespace the loader publishes, before the client adds `create` and scopes it to a plugin. */
export type LoaderObjCBridge = Omit<NativeObjCBridge, 'create'> & NativeUIScopeFactory;
