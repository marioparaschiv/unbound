/**
 * @name capitalize
 * @description Capitalizes the first letter of a string.
 * @param {string} string - The string to capitalize the first letter of
 * @return {string} Returns a string with an uppercased first letter
 */

function capitalize(input: string): string {
	if (typeof input !== 'string') {
		throw new TypeError('capitalize\'s first argument must be of type string');
	}

	return input.charAt(0).toUpperCase() + input.slice(1);
};

export default capitalize;