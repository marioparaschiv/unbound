const UNITS = [
	{ suffix: 'w', name: 'week', ms: 604_800_000 },
	{ suffix: 'd', name: 'day', ms: 86_400_000 },
	{ suffix: 'h', name: 'hour', ms: 3_600_000 },
	{ suffix: 'm', name: 'minute', ms: 60_000 },
	{ suffix: 's', name: 'second', ms: 1000 },
] as const;

/** A command's text with its leading duration split off. */
export type DurationSplit = { durationMs?: number; reason?: string };

const DURATION = /^(?:\d+[wdhms])+$/;
const PART = /(\d+)([wdhms])/g;

/**
 * @description Reads a Carl-bot style duration such as `30m`, `1d` or `1w2d12h`.
 * @param text The duration, in weeks, days, hours, minutes and seconds.
 * @returns The duration in milliseconds, or undefined when the text is not one or is zero.
 */
export function parseDuration(text: string): number | undefined {
	const lower = text.trim().toLowerCase();

	if (!DURATION.test(lower)) return;

	let total = 0;

	for (const [, amount, suffix] of lower.matchAll(PART)) {
		const unit = UNITS.find((candidate) => candidate.suffix === suffix);

		total += Number(amount) * (unit?.ms ?? 0);
	}

	return total > 0 ? total : undefined;
}

/**
 * @description Spells a duration out, e.g. `1 day, 12 hours`.
 * @param ms The duration in milliseconds; below a second reads as `0 seconds`.
 * @returns The duration in words, largest unit first.
 */
export function formatDuration(ms: number): string {
	const parts: string[] = [];
	let left = ms;

	for (const { name, ms: size } of UNITS) {
		const amount = Math.floor(left / size);

		if (amount > 0) {
			parts.push(`${amount} ${name}${amount === 1 ? '' : 's'}`);
			left -= amount * size;
		}
	}

	return parts.join(', ') || '0 seconds';
}

/**
 * @description Splits a leading duration off a command's text, as in `!ban @user 7d spam`.
 * @param text What follows the user.
 * @returns The duration, if the first word is one, and the rest as the reason, if any.
 */
export function splitDuration(text: string): DurationSplit {
	const trimmed = text.trim();
	const [first = ''] = trimmed.split(/\s+/);
	const durationMs = parseDuration(first);

	if (durationMs === undefined) {
		return trimmed ? { reason: trimmed } : {};
	}

	const reason = trimmed.slice(first.length).trim();

	return reason ? { durationMs, reason } : { durationMs };
}

export default { parseDuration, formatDuration, splitDuration };
