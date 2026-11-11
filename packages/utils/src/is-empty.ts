/**
 * @description Checks for enumerable keys, inherited ones included, stopping at the first without building a key array.
 * @returns Whether no key was found.
 */
function isEmpty<T>(object: Record<PropertyKey, T>) {
	for (const _ in object) {
		return false;
	}

	return true;
}

export default isEmpty;
