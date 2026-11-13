import type { NativeJavaHandleValue, NativeObjectHandle } from '@unbound-app/types';

/** A native object the explorer can open: an Objective-C handle or a Java handle value. */
export type ExplorerHandle = NativeObjectHandle | NativeJavaHandleValue;

/** Hands out refs for native handles, keeping the most recently used ones alive. */
export type ObjectRegistry<H> = {
	/** This runtime's epoch, the prefix of every ref it hands out. */
	readonly epoch: string;
	/** Returns the handle's ref, the one it already has or a new one, and marks it most recently used. */
	register(handle: H): string;
	/** Looks a ref up and marks it most recently used; an evicted, cleared or other runtime's ref finds nothing. */
	resolve(ref: string): H | undefined;
	/** Checks whether the registry keeps this handle alive. */
	holds(handle: H): boolean;
	/** Drops every ref. */
	clear(): void;
};

type RegistryOptions<H> = {
	/** The most handles kept; the least recently used is dropped past it. */
	capacity?: number;
	epoch?: string;
	/** What makes two handles the same object; the handle itself by default. */
	// UNKNOWN: any value compared by identity, such as a handle or a Java handle id, keys the map.
	key?: (handle: H) => unknown;
};

const DEFAULT_CAPACITY = 256;

/**
 * @description Makes a random epoch, so a ref from before a JavaScript reload never resolves after it.
 * @returns Six base-36 characters.
 */
export function newEpoch(): string {
	return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/**
 * @description Creates a registry of refs `<epoch>:<n>` for native handles, capped as a least recently used cache.
 * Dropping a handle only lets the loader release it once nothing else holds it.
 * @template H The handle type.
 * @param options The capacity, epoch and identity key.
 * @returns The registry.
 */
export function createObjectRegistry<H>({
	capacity = DEFAULT_CAPACITY,
	epoch = newEpoch(),
	key = (handle) => handle,
}: RegistryOptions<H> = {}): ObjectRegistry<H> {
	// Insertion order is use order: a used entry is deleted and set again, so the first one is the least recent.
	const handles = new Map<string, H>();
	const refs = new Map<unknown, string>();
	let next = 0;

	function touch(ref: string, handle: H) {
		handles.delete(ref);
		handles.set(ref, handle);
	}

	function register(handle: H): string {
		const known = refs.get(key(handle));

		if (known) {
			touch(known, handle);

			return known;
		}

		const ref = `${epoch}:${++next}`;

		handles.set(ref, handle);
		refs.set(key(handle), ref);

		for (const [oldest, dropped] of handles) {
			if (handles.size <= capacity) {
				break;
			}

			handles.delete(oldest);
			refs.delete(key(dropped));
		}

		return ref;
	}

	function resolve(ref: string): H | undefined {
		const handle = handles.get(ref);

		if (handle !== undefined) {
			touch(ref, handle);
		}

		return handle;
	}

	function clear() {
		handles.clear();
		refs.clear();
	}

	return { epoch, register, resolve, holds: (handle) => refs.has(key(handle)), clear };
}

/**
 * @description Checks whether a handle is a Java handle value, which names its object by id.
 * @param handle The handle.
 * @returns Whether it is a Java handle.
 */
export function isJavaHandle(handle: ExplorerHandle): handle is NativeJavaHandleValue {
	// A property read, not `in`, so an Objective-C host object is never asked to enumerate its properties.
	return (handle as Partial<NativeJavaHandleValue>).type === 'handle';
}

/** The explorer's refs for this JavaScript runtime. A Java handle is the same object as another with its id. */
export const explorerObjects = createObjectRegistry<ExplorerHandle>({
	key: (handle) => (isJavaHandle(handle) ? handle.value : handle),
});

export default { newEpoch, createObjectRegistry, isJavaHandle, explorerObjects };
