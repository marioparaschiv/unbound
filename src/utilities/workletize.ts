import type { WorkletizedFunction } from '@typings/utilities/workletize';

/**
 * @description Turns a function into a worklet for use within React Native Reanimated runOnUI, runOnJS, and worklet runtime calls.
 * - This aims to be a replacement for the compile-time workletization React Native Reanimated's Babel plugin provides.
 * - Any variable referenced inside of the function code MUST be added to the closure object.
 * - Any functions inside of the closure object must also be workletized. Common functions like console.log already exist.
 * - Please also ensure that all code inside of the worklet is compatible with [Hermes](https://github.com/facebook/hermes/blob/main/doc/Features.md) (our JS runtime)
 * - Hermes does not have .toString() compatibility as it executes from bytecode. Due to this, you have to pass the function code as a raw string argument (func.toString() will not work).
 * - To check if the function is running on the UI thread, please use `if (_WORKLET)`
 * @param instance The function instance you would like to workletize.
 * @param code The string version of the function to eval on the worklet runtime (e.g. runOnUI or runOnJS)
 * @param closure An object containing all variables referenced inside of the string version of the function. Please note: any referenced functions MUST be workletized.
 * @returns The same function you passed, with worklet properties added to it.
 */
function workletize(instance: Partial<WorkletizedFunction>, code: string, closure: Record<string, any> = {}): WorkletizedFunction {
	instance.__initData = { code };
	instance.__closure = closure;
	instance.__workletHash = createWorkletHash(code);

	return instance as WorkletizedFunction;
}

function createWorkletHash(code: string) {
	let i = code.length;
	let hash1 = 5381;
	let hash2 = 52711;

	while (i--) {
		const char = code.charCodeAt(i);
		hash1 = (hash1 * 33) ^ char;
		hash2 = (hash2 * 33) ^ char;
	}

	return (hash1 >>> 0) * 4096 + (hash2 >>> 0);
}

export default workletize;