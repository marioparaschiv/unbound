import type { NativePointer, NativeStruct } from './native-handles';

/** A C type in an FFI signature; `object`, `class` and `selector` exist only on iOS. */
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

/** An FFI type: a scalar or pointer name, or a registered struct by name, such as `{ struct: 'CGRect' }`. */
export type NativeFFIType = NativeFFITypeName | { struct: string };

/** A non-variadic C function signature for `ffi.call`. */
export type NativeFFISignature = {
	/** The result type; `i64` and `u64` results come back as `BigInt`. */
	returnType: NativeFFIType;
	/** The argument types, at most 16 and none `void`. */
	args: NativeFFIType[];
};

/** Calls C functions in images Discord already loaded. An unsigned plugin needs the user's consent to use it. */
export type NativeFFIBridge = {
	/** Resolves a symbol in a loaded image, or in every loaded image when `image` is omitted; `null` when not found. */
	symbol(name: string, image?: string): NativePointer | null;
	/** Calls a symbol from `symbol` with an explicit signature. */
	// UNKNOWN: the result's type is described at runtime by `signature.returnType`.
	call(pointer: NativePointer, signature: NativeFFISignature, ...args: unknown[]): unknown;
	/** Allocates zeroed memory for out-parameters and buffers; free it with `free`. Needs `native.ffi.memory`. */
	alloc(size: number): NativePointer;
	/** Frees memory from `alloc`; `false` for any other pointer. Needs `native.ffi.memory`. */
	free(pointer: NativePointer): boolean;
	/** Reads a value of a type at a pointer, `offset` bytes in, failing safely on an unreadable address. Needs `native.ffi.memory`. */
	read(pointer: NativePointer, type: NativeFFIType, offset?: number): NativeFFIValue;
	/** Writes a value of a type into memory from `alloc`, `offset` bytes in. Needs `native.ffi.memory`. */
	write(
		pointer: NativePointer,
		type: NativeFFIType,
		value: NativeFFIValue,
		offset?: number,
	): void;
	/**
	 * Makes a C function pointer that runs `implementation` on the JavaScript thread; 32 per return kind live at
	 * once, so release each with `releaseCallback`. Needs `native.ffi.callbacks`.
	 */
	callback(
		signature: NativeFFISignature,
		implementation: (...args: never[]) => NativeFFIValue | void,
	): NativePointer;
	/** Frees a pointer from `callback`. Needs `native.ffi.callbacks`. */
	releaseCallback(pointer: NativePointer): boolean;
	/**
	 * Points every image's imports of a C function at `replacement`, such as a pointer from `callback`, and returns
	 * the original to call through; the loader's own calls keep the original. Needs `native.ffi.rebind`.
	 */
	rebind(name: string, replacement: NativePointer): NativeFFIRebinding;
	/** Puts back every import `rebind` changed for a symbol. Needs `native.ffi.rebind`. */
	restore(name: string): boolean;
};

/** A value an FFI type reads or writes: a number, `BigInt` for 64-bit integers, a boolean, a string or a pointer. */
export type NativeFFIValue =
	| number
	| bigint
	| boolean
	| string
	| NativePointer
	| NativeStruct
	| null;

/** What `rebind` changed: the original function and how many import slots now point at the replacement. */
export type NativeFFIRebinding = {
	/** The function the import slots pointed at before. */
	original: NativePointer;
	/** How many import slots now point at the replacement. */
	slots: number;
};
