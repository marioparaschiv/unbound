import resolveMomentLocale from './resolve-moment-locale';

type LocaleSetter = (...args: any[]) => any;

function createMomentLocaleSetter<T extends LocaleSetter>(
	original: T,
	getLocale: () => string,
	getAvailableLocales: () => string[],
): T {
	return function (this: unknown, ...args: Parameters<T>) {
		if (typeof args[0] !== 'string' && !Array.isArray(args[0])) {
			return original.apply(this, args);
		}

		const locale = resolveMomentLocale(getLocale(), getAvailableLocales());
		return original.apply(this, [locale, ...args.slice(1)] as Parameters<T>);
	} as T;
}

export default createMomentLocaleSetter;
