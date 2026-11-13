import type {
	LoaderObjCBridge,
	NativeBatchReference,
	NativeBatchStep,
	NativeObjCResult,
	NativeObjectHandle,
	NativeStruct,
	NativeStructFields,
} from '@unbound-app/types';

/** The most steps the Objective-C bridge runs in one `objc.batch`. */
const BATCH_STEPS = 64;

function isReference(value: unknown): value is NativeBatchReference {
	return typeof value === 'object' && value !== null && '$nativeBatchResult' in value;
}

/**
 * @description Reads a number result; a `bigint`, as an unsigned integer may return, is narrowed.
 * @param value The result.
 * @returns The number, or `undefined` when the result is not one.
 */
export function asNumber(value: NativeObjCResult): number | undefined {
	if (typeof value === 'bigint') {
		return Number(value);
	}

	return typeof value === 'number' ? value : undefined;
}

/**
 * @description Reads a `BOOL` result, which some encodings return as 0 or 1.
 * @param value The result.
 * @returns The flag.
 */
export function asFlag(value: NativeObjCResult): boolean {
	return value === true || value === 1;
}

/**
 * @description Reads a string result.
 * @param value The result.
 * @returns The string, or `''` when the result is not one.
 */
export function asText(value: NativeObjCResult): string {
	return typeof value === 'string' ? value : '';
}

function isStruct(value: NativeObjCResult): value is NativeStruct {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Partial<NativeStruct>).name === 'string'
	);
}

/**
 * @description Reads an object result.
 * @param value The result.
 * @returns The handle, or `undefined` for `nil`, structs and plain values.
 */
export function asObject(value: NativeObjCResult): NativeObjectHandle | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value) && !isStruct(value)
		? (value as NativeObjectHandle)
		: undefined;
}

/**
 * @description Reads a struct result's fields, such as a `CGRect`'s `origin` and `size`.
 * @param value The result.
 * @returns The fields, or `undefined` when the result is not a struct.
 */
export function asStruct(value: NativeObjCResult): NativeStructFields | undefined {
	return isStruct(value) ? value.value : undefined;
}

/**
 * @description Runs dependent steps on the main thread in as few batches as the bridge allows. Steps come in groups
 * that refer only to earlier steps of their own group, so a group never splits across batches.
 * @param objc The Objective-C bridge.
 * @param steps The steps; `$nativeBatchResult` indexes count from the first step.
 * @param group How many steps make one group.
 * @returns Each step's result, in order.
 */
export async function onMainThread(
	objc: Pick<LoaderObjCBridge, 'batch'>,
	steps: NativeBatchStep[],
	group: number,
): Promise<NativeObjCResult[]> {
	const size = Math.max(Math.floor(BATCH_STEPS / group), 1) * group;
	const results: NativeObjCResult[] = [];

	for (let start = 0; start < steps.length; start += size) {
		// UNKNOWN: a step's target and arguments may be any value the bridge accepts, or a batch reference.
		const rebase = (value: unknown) =>
			isReference(value) ? { $nativeBatchResult: value.$nativeBatchResult - start } : value;
		const chunk = steps.slice(start, start + size).map((step) => ({
			...step,
			target: rebase(step.target) as NativeBatchStep['target'],
			args: step.args.map(rebase),
		}));

		results.push(...(await objc.batch(chunk)));
	}

	return results;
}

export default { asNumber, asFlag, asText, asObject, asStruct, onMainThread };
