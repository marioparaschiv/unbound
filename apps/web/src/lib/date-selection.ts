import type { DateRange } from 'react-day-picker';

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
});

const DAY_MS = 24 * 60 * 60 * 1000;

export const EMPTY_RANGE: DateRange = { from: undefined, to: undefined };

// Rounded so a daylight-saving shift between the days cannot break a tie.
function daysBetween(start: Date, end: Date) {
	return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function moveBound(from: Date, to: Date, day: Date): DateRange {
	const afterFrom = daysBetween(from, day);
	const beforeTo = daysBetween(day, to);

	if (beforeTo === 0) {
		return { from, to: undefined };
	}

	if (afterFrom === 0) {
		return { from: undefined, to };
	}

	return afterFrom < beforeTo ? { from: day, to } : { from, to: day };
}

/**
 * @description Applies a clicked day to a range in which either bound may be set on its own.
 * @param range The current range.
 * @param day The clicked day.
 * @returns With both bounds set, the range with its nearer bound moved to the day, or cleared when the day is that bound; otherwise the day and the set bound in order.
 */
export function nextRange({ from, to }: DateRange, day: Date): DateRange {
	if (from && to) {
		return moveBound(from, to, day);
	}

	const anchor = from ?? to;

	if (!anchor) {
		return { from: day, to: undefined };
	}

	return anchor <= day ? { from: anchor, to: day } : { from: day, to: anchor };
}

/**
 * @description Labels a single picked day.
 * @param date The picked day, if any.
 * @param placeholder The label while no day is picked.
 * @returns The day, such as `12 Oct 2026`, or the placeholder.
 */
export function describeDate(date: Date | undefined, placeholder: string): string {
	return date ? DAY_FORMAT.format(date) : placeholder;
}

/**
 * @description Labels a range in which either bound may be set on its own.
 * @param range The range.
 * @param placeholder The label while neither bound is set.
 * @returns `a – b`, `From a`, `Until b`, or the placeholder.
 */
export function describeRange({ from, to }: DateRange, placeholder: string): string {
	if (from && to) {
		return `${DAY_FORMAT.format(from)} – ${DAY_FORMAT.format(to)}`;
	}

	if (from) {
		return `From ${DAY_FORMAT.format(from)}`;
	}

	if (to) {
		return `Until ${DAY_FORMAT.format(to)}`;
	}

	return placeholder;
}

export default { EMPTY_RANGE, nextRange, describeDate, describeRange };
