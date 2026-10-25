(() => {
	const key = '__unboundNativeFailure';
	const owns = Object.prototype.hasOwnProperty;
	const NativeError = Error;

	const guard = (native) =>
		function (...args) {
			const result = native.apply(this, args);
			const failure =
				result !== null && typeof result === 'object' && owns.call(result, key) ? result[key] : null;

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
