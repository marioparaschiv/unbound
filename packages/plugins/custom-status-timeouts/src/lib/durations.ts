const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 } as const;
const MAX_MS = 30 * UNIT_MS.d;
const ENTRY = /^(\d+)\s*([mhdw])$/;

/** A duration's unit. */
export type DurationUnit = keyof typeof UNIT_MS;

/**
 * @description Reads a comma-separated list of durations such as `15m, 8h, 3d`, skipping entries it cannot read.
 * @param text The list.
 * @returns The durations in milliseconds, unique and shortest first, each at most 30 days.
 */
export function parseDurations(text: string): number[] {
	const durations = text
		.split(',')
		.map((entry) => ENTRY.exec(entry.trim().toLowerCase()))
		.map((match) => (match ? Number(match[1]) * UNIT_MS[match[2] as DurationUnit] : 0))
		.filter((ms) => ms > 0 && ms <= MAX_MS);

	return [...new Set(durations)].sort((a, b) => a - b);
}

/**
 * @description Splits a duration into the largest unit that divides it evenly.
 * @param ms The duration in milliseconds.
 * @returns The count and its unit.
 */
export function durationParts(ms: number): { count: number; unit: DurationUnit } {
	const unit = (['w', 'd', 'h'] as const).find((name) => ms % UNIT_MS[name] === 0) ?? 'm';

	return { count: Math.round(ms / UNIT_MS[unit]), unit };
}

const TODAY_MS = UNIT_MS.d;

function lengthOf(option: number | string): number {
	if (option === 'TODAY') return TODAY_MS;

	return typeof option === 'number' ? option : -1;
}

/**
 * @description Adds durations to Discord's Clear after options, longest first like Discord, with Don't clear last.
 * @param options Discord's options: milliseconds, `TODAY` (24 hours) and `DONT_CLEAR`.
 * @param extra The durations to add.
 * @returns The options with the extra durations among them.
 */
export function withDurations(options: (number | string)[], extra: number[]): (number | string)[] {
	const added = extra.filter((ms) => ms !== TODAY_MS && !options.includes(ms));

	return [...options, ...added].sort((a, b) => lengthOf(b) - lengthOf(a));
}
