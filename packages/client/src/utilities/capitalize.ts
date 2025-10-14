/**
 * @description Capitalizes the first letter of a string.
 * @param input The string to capitalize.
 * @returns The capitalized string.
 */
function capitalize(input: string): string {
	if (typeof input !== 'string') {
		throw new TypeError('The first argument for "capitalize" must be of type string');
	}

	return input.charAt(0).toUpperCase() + input.slice(1);
};

export default capitalize;