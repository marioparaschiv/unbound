import resolveMomentLocale from './resolve-moment-locale';

function createMomentCalendarLocale<This, A extends unknown[], R>(
	original: (this: This, ...args: A) => R,
	getLocale: () => string,
	getAvailableLocales: () => string[],
	setInstanceLocale: (this: This, locale: string) => void,
): (this: This, ...args: A) => R {
	return function (this: This, ...args: A) {
		setInstanceLocale.call(this, resolveMomentLocale(getLocale(), getAvailableLocales()));

		return original.apply(this, args);
	};
}

export default createMomentCalendarLocale;
