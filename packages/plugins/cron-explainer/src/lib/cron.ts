export type CronField = {
	source: string;
	values: Set<number>;
	any: boolean;
};

export type Cron = {
	source: string;
	minute: CronField;
	hour: CronField;
	day: CronField;
	month: CronField;
	weekday: CronField;
};

export type CalendarDay = { day: number; month: number; weekday: number };

export type CronErrorCode = 'FIELD_COUNT' | 'BAD_FIELD' | 'UNKNOWN_MACRO';

export class CronError extends Error {
	override name = 'CronError';

	constructor(
		readonly code: CronErrorCode,
		readonly field = '',
	) {
		super(code);
	}
}

type FieldSpec = { min: number; max: number; names?: string[] };

const MONTH_NAMES = [
	'JAN',
	'FEB',
	'MAR',
	'APR',
	'MAY',
	'JUN',
	'JUL',
	'AUG',
	'SEP',
	'OCT',
	'NOV',
	'DEC',
];
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const SPECS: FieldSpec[] = [
	{ min: 0, max: 59 },
	{ min: 0, max: 23 },
	{ min: 1, max: 31 },
	{ min: 1, max: 12, names: MONTH_NAMES },
	{ min: 0, max: 7, names: WEEKDAY_NAMES },
];

const MACROS: Record<string, string> = {
	'@yearly': '0 0 1 1 *',
	'@annually': '0 0 1 1 *',
	'@monthly': '0 0 1 * *',
	'@weekly': '0 0 * * 0',
	'@daily': '0 0 * * *',
	'@midnight': '0 0 * * *',
	'@hourly': '0 * * * *',
};

function readNumber(text: string, spec: FieldSpec, source: string): number {
	const named = spec.names?.indexOf(text.toUpperCase()) ?? -1;
	const value = named >= 0 ? named + (spec.names === MONTH_NAMES ? 1 : 0) : Number(text);

	if (!/^\w+$/.test(text) || !Number.isInteger(value) || value < spec.min || value > spec.max) {
		throw new CronError('BAD_FIELD', source);
	}

	return value;
}

function readPart(part: string, spec: FieldSpec, source: string): number[] {
	const [range = '', stepText] = part.split('/');
	const step = stepText === undefined ? 1 : Number(stepText);

	if (!Number.isInteger(step) || step < 1) throw new CronError('BAD_FIELD', source);

	const [fromText = '', toText] = range.split('-');
	const from = range === '*' ? spec.min : readNumber(fromText, spec, source);
	const to =
		range === '*'
			? spec.max
			: toText !== undefined
				? readNumber(toText, spec, source)
				: stepText === undefined
					? from
					: spec.max;

	if (to < from) throw new CronError('BAD_FIELD', source);

	const values: number[] = [];

	for (let value = from; value <= to; value += step) values.push(value);

	return values;
}

function readField(source: string, spec: FieldSpec, isWeekday: boolean): CronField {
	const values = new Set<number>();

	for (const part of source.split(',')) {
		for (const value of readPart(part, spec, source)) values.add(isWeekday ? value % 7 : value);
	}

	return {
		source,
		values: new Set([...values].sort((a, b) => a - b)),
		any: source === '*' || source === '?',
	};
}

/**
 * @description Reads a five-field cron expression (minute, hour, day of month, month, weekday) with lists, ranges,
 * steps, month and weekday names, `7` for Sunday, and macros such as `@daily`.
 * @param expression The expression.
 * @returns The parsed fields.
 */
export function parseCron(expression: string): Cron {
	const trimmed = expression.trim().toLowerCase();

	if (trimmed.startsWith('@') && !MACROS[trimmed]) throw new CronError('UNKNOWN_MACRO', trimmed);

	const source = MACROS[trimmed] ?? expression.trim().replace(/\s+/g, ' ');
	const fields = source.split(' ');

	if (fields.length !== 5) throw new CronError('FIELD_COUNT');

	const [minute, hour, day, month, weekday] = fields.map((field, index) =>
		readField(field === '?' ? '*' : field, SPECS[index]!, index === 4),
	) as [CronField, CronField, CronField, CronField, CronField];

	return {
		source,
		minute,
		hour,
		day: { ...day, any: fields[2] === '*' || fields[2] === '?' },
		month,
		weekday: { ...weekday, any: fields[4] === '*' || fields[4] === '?' },
	};
}

/**
 * @description Whether a cron runs on a calendar day. As in standard cron, when both the day of the month and the
 * weekday are restricted, either one matching is enough.
 * @param cron The cron.
 * @param day The day of the month, month (1–12) and weekday (0 is Sunday).
 * @returns `true` when the cron runs that day.
 */
export function matchesDay(cron: Cron, { day, month, weekday }: CalendarDay): boolean {
	if (!cron.month.values.has(month)) return false;

	const byDay = cron.day.values.has(day);
	const byWeekday = cron.weekday.values.has(weekday);

	if (cron.day.any && cron.weekday.any) return true;
	if (cron.day.any) return byWeekday;
	if (cron.weekday.any) return byDay;

	return byDay || byWeekday;
}

export default { parseCron, matchesDay };
