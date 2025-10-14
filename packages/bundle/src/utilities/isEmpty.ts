/**
 * @description Checks if an object is empty.
 * @param object The object to check.
 * @returns A boolean indicating whether the object is empty or not.
 */
function isEmpty(object: Record<any, any>) {
	for (const _ in object) {
		return false;
	}

	return true;
}

export default isEmpty;