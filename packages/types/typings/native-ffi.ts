import type { NativePointer } from './native-handles';

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
};
