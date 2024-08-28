/**
 * @description Throttles a function by the provided milliseconds.
 * @template T The function's type. Used to provide autocomplete for function arguments.
 * @param func The function to debounce.
 * @param ms The milliseconds to debounce the function by.
 * @return An instance of the function wrapped in a debounce timer.
 */
function debounce<T extends Fn>(func: T, ms: number): (...args: Parameters<T>) => void {
	let timer;

	return function (...args: Parameters<T>) {
		clearTimeout(timer);
		timer = setTimeout(() => func.apply(this, args), ms);
	};
};

export default debounce;