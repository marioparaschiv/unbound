import resolveMomentLocale from './resolve-moment-locale';

function createMomentLocaleSetter<This, A extends unknown[], R>(
	original: (this: This, ...args: A) => R,
	getLocale: () => string,
	getAvailableLocales: () => string[],
): (this: This, ...args: A) => R {
	return function (this: This, ...args: A) {
		if (typeof args[0] !== 'string' && !Array.isArray(args[0])) {
			return original.apply(this, args);
		}

		args.splice(0, 1, resolveMomentLocale(getLocale(), getAvailableLocales()));

		return original.apply(this, args);
	};
}

export default createMomentLocaleSetter;
