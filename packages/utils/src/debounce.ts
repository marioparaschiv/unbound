/**
 * @description Delays `func` until `ms` have passed since the last call, then runs it once with that call's arguments.
 * @returns The debounced function.
 */
function debounce<A extends unknown[]>(
	func: (...args: A) => void,
	ms: number,
): (...args: A) => void {
	let timer;

	return function (...args: A) {
		clearTimeout(timer);
		timer = setTimeout(() => func.apply(this, args), ms);
	};
}

export default debounce;
