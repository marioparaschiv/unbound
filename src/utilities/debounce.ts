/**
 * @description Throttles a function by the provided milliseconds
 * @param {function} func - The function to debounce
 * @param {number} ms - The milliseconds to debounce the function by
 * @return {function} Returns an instance of the function wrapped in a debounce
 */

function debounce(func: Fn, ms: number): Fn {
	let timer;

	return function (...args) {
		clearTimeout(timer);
		timer = setTimeout(() => func.apply(this, args), ms);
	};
};

export default debounce;