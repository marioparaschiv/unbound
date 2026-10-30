/**
 * @description Turns a function into a script the debugger bridge evaluates on the device: the function's own source, called with its arguments encoded as JSON. The function runs in Discord's JavaScript runtime, so it can use only its parameters and the device's globals, never anything else from this module.
 * @param run The function to run on the device.
 * @param args Its arguments, which must survive `JSON.stringify`.
 * @returns The script.
 */
export function deviceScript<A extends unknown[]>(
	run: (...args: A) => unknown,
	...args: A
): string {
	return `(${run.toString()})(${args.map((arg) => JSON.stringify(arg) ?? 'undefined').join(', ')})`;
}
