/**
 * @description Attempts calling a function and bails if it fails.
 * @template T Your function's type. Used for inferring the return type.
 * @param callback The function to attempt calling.
 * @returns The function result or an Error instance.
 */
function attempt<T extends Fn>(callback: T): ReturnType<T> | Error {
	try {
		const res = callback();

		if ((res satisfies Promise<any>) instanceof Promise) {
			return res;
		}

		return res;
	} catch (error) {
		return error;
	}
};

export default attempt;