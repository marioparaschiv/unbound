// The formats the contracts register with typebox, which checks one only when a checker is. They
// live here so the client's generated checks inline them instead of shipping typebox's formats.

/**
 * @description Tells whether `value` is an absolute URL.
 * @param value The candidate URL.
 * @returns Whether it parses as one.
 */
export function isUrl(value: string): boolean {
	if (typeof URL !== 'undefined' && typeof URL.canParse === 'function') {
		return URL.canParse(value);
	}

	try {
		new URL(value);

		return true;
	} catch {
		return false;
	}
}

/**
 * @description Tells whether `value` is a calendar date in `YYYY-MM-DD` form.
 * @param value The candidate date.
 * @returns Whether the day exists in that month.
 */
export function isDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

	if (!match) {
		return false;
	}

	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const days = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	return month >= 1 && month <= 12 && day >= 1 && day <= (days[month] ?? 0);
}

// RFC 3339 with a required timezone offset, as zod's `z.iso.datetime()` accepts.
const TIME = /^(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:[Zz]|[+-](\d\d):(\d\d))$/;

/**
 * @description Tells whether `value` is an RFC 3339 date-time with a timezone offset.
 * @param value The candidate date-time.
 * @returns Whether its date and time are valid.
 */
export function isDateTime(value: string): boolean {
	const parts = value.split(/[Tt]/);

	if (parts.length !== 2 || !isDate(parts[0] ?? '')) {
		return false;
	}

	const match = TIME.exec(parts[1] ?? '');

	if (!match) {
		return false;
	}

	const [hour, minute, second] = [Number(match[1]), Number(match[2]), Number(match[3])];

	return hour <= 23 && minute <= 59 && second <= 60;
}

/**
 * @description Tells whether `value` is a UUID.
 * @param value The candidate UUID.
 * @returns Whether it has the canonical 8-4-4-4-12 hex shape.
 */
export function isUuid(value: string): boolean {
	return /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
}

export default { isUrl, isDate, isDateTime, isUuid };
