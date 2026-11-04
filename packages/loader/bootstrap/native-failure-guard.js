(() => {
	const key = '__unboundNativeFailure';
	const NativeError = Error;
	const ObjectPrototype = Object.prototype;
	const getPrototypeOf = Object.getPrototypeOf;

	const failureOf = (result) =>
		result !== null &&
		typeof result === 'object' &&
		getPrototypeOf(result) === ObjectPrototype &&
		Object.prototype.hasOwnProperty.call(result, key)
			? result[key]
			: null;

	const guard = (native) =>
		function (...args) {
			const result = native.apply(this, args);
			const failure = failureOf(result);

			if (failure !== null && typeof failure === 'object') {
				const error = new NativeError(String(failure.message));

				error.code = String(failure.code);

				throw error;
			}

			return result;
		};

	Object.defineProperty(globalThis, '__unboundGuardNativeFunction', { value: guard });

	return guard;
})();
