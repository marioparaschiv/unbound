import resolveMomentLocale from './resolve-moment-locale';

type CalendarMethod = (...args: any[]) => any;
type InstanceLocaleSetter = (this: unknown, locale: string) => unknown;

function createMomentCalendarLocale<T extends CalendarMethod>(
	original: T,
	getLocale: () => string,
	getAvailableLocales: () => string[],
	setInstanceLocale: InstanceLocaleSetter,
): T {
	return function (this: unknown, ...args: Parameters<T>) {
		setInstanceLocale.call(this, resolveMomentLocale(getLocale(), getAvailableLocales()));
		return original.apply(this, args);
	} as T;
}

export default createMomentCalendarLocale;
