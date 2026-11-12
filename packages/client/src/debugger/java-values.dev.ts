import type {
	NativeJavaArgument,
	NativeJavaBatchOperation,
	NativeJavaBridge,
	NativeJavaHandleValue,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/types';

/** The most operations the Java bridge runs in one `batchAsync`. */
const BATCH_STEPS = 64;

export const int = (value: number): NativeJavaArgument => ({
	type: 'int',
	value: Math.round(value),
});

export const handle = (value: NativeJavaValue | undefined): NativeJavaHandleValue | undefined =>
	value?.type === 'handle' ? value : undefined;

export const number = (value: NativeJavaValue | undefined): number =>
	value && 'value' in value && typeof value.value === 'number' ? value.value : 0;

export const string = (value: NativeJavaValue | undefined): string =>
	value?.type === 'string' ? value.value : '';

export const isTrue = (value: NativeJavaValue | undefined): boolean =>
	Boolean(value && 'value' in value && value.value === true);

/**
 * @description Reads a primitive Java value as a property value; objects and arrays read as `null`.
 * @param value The value.
 * @returns The string, number or flag, or `null`.
 */
export function primitive(value: NativeJavaValue | undefined): string | number | boolean | null {
	if (!value || value.type === 'null' || value.type === 'handle' || value.type === 'array') {
		return null;
	}

	return value.value;
}

/**
 * @description Builds one argument-less call per method name on a target.
 * @param target The object to call.
 * @param names The method names.
 * @returns One operation per name, in order.
 */
export function calls(
	target: NativeJavaReference,
	names: readonly string[],
): NativeJavaBatchOperation[] {
	return names.map((name) => ({ op: 'invoke', handle: target, name, args: [] }));
}

/**
 * @description Runs Java operations on the main thread, where views must be read, in as few hops as the bridge allows.
 * @param java The Java bridge.
 * @param operations The operations; a failing one rejects its whole batch.
 * @returns Each operation's result, in order.
 */
export async function onMain(
	java: Pick<NativeJavaBridge, 'batchAsync'>,
	operations: NativeJavaBatchOperation[],
): Promise<NativeJavaValue[]> {
	const results: NativeJavaValue[] = [];

	for (let start = 0; start < operations.length; start += BATCH_STEPS) {
		results.push(...(await java.batchAsync(operations.slice(start, start + BATCH_STEPS))));
	}

	return results;
}

/**
 * @description Reads the results of {@link calls} back by method name.
 * @param names The method names the calls were built from.
 * @param results The batch's results for those calls.
 * @returns The results by name.
 */
export function byName(
	names: readonly string[],
	results: NativeJavaValue[],
): Map<string, NativeJavaValue> {
	return new Map(names.map((name, index) => [name, results[index] ?? { type: 'null' }]));
}

export default { int, handle, number, string, isTrue, primitive, calls, onMain, byName };
