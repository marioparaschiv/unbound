import type {
	NativeJavaHandleValue,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';

/**
 * @description Tags a number as a Java `int`.
 * @param value The number.
 * @returns The tagged value.
 */
export function javaInt(value: number): NativeJavaValue {
	return { type: 'int', value: Math.trunc(value) };
}

/**
 * @description Tags a number as a Java `float`.
 * @param value The number.
 * @returns The tagged value.
 */
export function javaFloat(value: number): NativeJavaValue {
	return { type: 'float', value };
}

/**
 * @description Tags a string as a Java `String`.
 * @param value The string.
 * @returns The tagged value.
 */
export function javaString(value: string): NativeJavaValue {
	return { type: 'string', value };
}

/**
 * @description Tags a boolean as a Java `boolean`.
 * @param value The boolean.
 * @returns The tagged value.
 */
export function javaBoolean(value: boolean): NativeJavaValue {
	return { type: 'boolean', value };
}

/**
 * @description Tells whether a Java result is an object handle.
 * @param value The result.
 * @returns `true` for a handle, which can be passed back as a target or argument.
 */
export function isJavaHandle(
	value: NativeJavaValue | null | undefined,
): value is NativeJavaHandleValue {
	return value?.type === 'handle';
}

/**
 * @description Reads a Java result as an object reference.
 * @param value The result.
 * @returns The handle, or `null` for Java `null` and non-object results.
 */
export function javaReference(
	value: NativeJavaValue | null | undefined,
): NativeJavaReference | null {
	return isJavaHandle(value) ? value : null;
}

/**
 * @description Keys a Java view by its handle, for maps of per-view state.
 * @param view The view.
 * @returns The handle's id, or `undefined` when the value is not a handle.
 */
export function javaViewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

/**
 * @description Reads a Java result as a string.
 * @param value The result.
 * @returns The string, or `undefined` when the result is not a `String` or `char`.
 */
export function javaText(value: NativeJavaValue | null | undefined): string | undefined {
	return value?.type === 'string' || value?.type === 'char' ? value.value : undefined;
}

/**
 * @description Reads a Java result as a boolean.
 * @param value The result.
 * @returns `true` only for a Java `true`.
 */
export function javaFlag(value: NativeJavaValue | null | undefined): boolean {
	return value?.type === 'boolean' && value.value;
}

/**
 * @description Tells whether two Java references point at the same object.
 * @param left A reference.
 * @param right Another reference.
 * @returns `true` when both are handles to the same object.
 */
export function sameJavaReference(
	left: NativeJavaReference | null | undefined,
	right: NativeJavaReference | null | undefined,
): boolean {
	const key = (reference: NativeJavaReference | null | undefined) =>
		reference && 'value' in reference
			? reference.value
			: reference && 'id' in reference
				? String((reference as { id: unknown }).id)
				: undefined;

	return key(left) !== undefined && key(left) === key(right);
}

/**
 * @description Reads a Java result as a number.
 * @param value The result.
 * @returns The number, or `undefined` when the result is not numeric.
 */
export function javaNumber(value: NativeJavaValue | null | undefined): number | undefined {
	switch (value?.type) {
		case 'byte':
		case 'short':
		case 'int':
		case 'long':
		case 'float':
		case 'double':
			return value.value;
		default:
			return undefined;
	}
}

export default {
	isJavaHandle,
	javaFlag,
	sameJavaReference,
	javaBoolean,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
	javaViewKey,
};
