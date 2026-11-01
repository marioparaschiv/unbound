import type { NativeFabricFrame } from './native-fabric';

declare const nativeHandle: unique symbol;

/** An opaque reference to a native object. Only the bridge creates handles; plugins pass them back. */
export type NativeHandle = {
	/** A type-only brand, absent at runtime, so plain objects cannot pass as handles. */
	readonly [nativeHandle]: true;
};

/** A handle to an Objective-C class, from `objc.getClass`. */
export type NativeClassHandle = NativeHandle;
/** A retained handle to an Objective-C object. */
export type NativeObjectHandle = NativeHandle;
/** A handle to a native symbol's address, from `ffi.symbol`; `ffi.call` accepts only these. */
export type NativePointer = NativeHandle;
/** A key from `objc.createAssociationKey` that names one associated object. */
export type NativeAssociationKey = NativeHandle;

/** A C struct field: a scalar, a pointer or object, or a nested struct. */
export type NativeStructField = number | boolean | NativeHandle | NativeStructFields;

/** A struct's field values by field name. */
export type NativeStructFields = {
	[field: string]: NativeStructField;
};

/** A registered C struct, such as `CGRect`, built by `objc.struct` or returned from a native call. */
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

/** A plain object of serializable values, such as a runtime event payload. */
export type NativeSerializableObject = {
	[key: string]: NativeSerializable;
};

/** Where a native call runs: `current` is the calling thread; `main` blocks until the main thread runs it. */
export type NativeThreadPolicy = 'current' | 'main';

/** A promise for native work; `cancel` drops it, and stopping the plugin cancels every pending one. */
export type NativeCancelablePromise<T> = Promise<T> & { cancel(): void };

/** Limits for `objc.snapshot`; larger values are clamped and non-integers rejected. */
export type NativeViewSnapshotOptions = {
	/** How many levels below the root to read. Defaults to 8, at most 12. */
	maxDepth?: number;
	/** How many views to return. Defaults to 100, at most 256. */
	maxNodes?: number;
};

/** Limits and direction for a breadth-first `findViews` search; larger limits are clamped. */
export type NativeViewSearchOptions = {
	/** How many levels to walk from the root. Defaults to 24, at most 128. */
	maxDepth?: number;
	/** How many views to visit. Defaults to 512, at most 8,192. */
	maxVisited?: number;
	/** How many matches to return. Defaults to 64, at most 256. */
	maxResults?: number;
	/** Matches only views attached to a window. */
	attachedOnly?: boolean;
	/** Skips the views beneath a match. */
	stopAtMatch?: boolean;
	/** `ancestors` walks up the superview chain instead of down. Defaults to `descendants`. */
	direction?: 'ancestors' | 'descendants';
};

/** One view in an `objc.snapshot` result, which lists views in breadth-first order. */
export type NativeViewSnapshotNode = {
	/** A retained handle to the view; discard it after cell reuse or a channel change. */
	view: NativeObjectHandle;
	/** The index of the parent node in the result, or -1 for the root. */
	parent: number;
	/** Levels below the root, which is 0. */
	depth: number;
	/** The view's Objective-C class name. */
	className: string;
	/** The view's `frame` in its superview's coordinates, in points. */
	frame: NativeFabricFrame;
	/** The view's `text` when it has a string one, such as a `UILabel`'s, else `null`. */
	text: string | null;
	/** Whether the view is not hidden, has a non-zero alpha and is in a window. */
	visible: boolean;
};

/** Options for a synchronous Objective-C call. */
export type NativeCallOptions = {
	/** The thread to run on. Defaults to `current`. */
	thread?: NativeThreadPolicy;
};
