/**
 * @name capitalize
 * @description Capitalizes the first letter of a string.
 * @param {string} string - The string to capitalize the first letter of
 * @return {string} Returns a string with an uppercased first letter
 */

function capitalize(string: string): string {
	if (typeof string !== 'string') {
		throw new TypeError('capitalize\'s first argument must be of type string');
	}

	return string.charAt(0).toUpperCase() + string.slice(1);
};

export default capitalize;