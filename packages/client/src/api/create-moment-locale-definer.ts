function createMomentLocaleDefiner<This, A extends unknown[], R>(
	original: (this: This, ...args: A) => R,
	restoreLocale: () => void,
): (this: This, ...args: A) => R {
	return function (this: This, ...args: A) {
		const result = original.apply(this, args);

		restoreLocale();

		return result;
	};
}

export default createMomentLocaleDefiner;
