/**
 * @description Narrows a lookup the test expects to find, failing the test when it returned `undefined`.
 * @template T The lookup's result.
 * @param value The lookup's result.
 * @returns The same value, without `undefined`.
 */
export function present<T>(value: T | undefined): T {
	if (value === undefined) {
		throw new Error('Expected the lookup to return a module, but it returned undefined.');
	}

	return value;
}
