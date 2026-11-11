/** The constraints a numeric input checks typed text against. */
export type NumberConstraints = {
	/** Rejects text with a fractional part. Defaults to false. */
	integer?: boolean;
	/** The smallest accepted value. */
	minimum?: number;
	/** The largest accepted value. */
	maximum?: number;
	/** Accepts only whole multiples of this. */
	step?: number;
};

/** Why typed text is not an acceptable number: a message key of Unbound's strings and its placeholders. */
export type NumberInputError = { key: string; vars?: Record<string, number> };

/** What {@link parseNumberInput} read: the number, or why the text is rejected. */
export type NumberInputResult = { value: number } | { error: NumberInputError };

/**
 * @description Reads the text typed into a numeric input and checks it against its constraints.
 * @param text What was typed; a comma is read as a decimal point.
 * @param constraints Whether the number must be whole, its range and its step.
 * @returns The number, or the first constraint it breaks.
 */
export function parseNumberInput(
	text: string,
	{ integer = false, minimum, maximum, step }: NumberConstraints,
): NumberInputResult {
	const trimmed = text.trim().replace(',', '.');
	const value = Number(trimmed);

	if (!trimmed || !Number.isFinite(value)) {
		return { error: { key: 'UNBOUND_SETTING_NOT_A_NUMBER' } };
	}

	if (integer && !Number.isInteger(value)) {
		return { error: { key: 'UNBOUND_SETTING_NOT_WHOLE' } };
	}

	if (minimum !== undefined && value < minimum) {
		return { error: { key: 'UNBOUND_SETTING_TOO_SMALL', vars: { minimum } } };
	}

	if (maximum !== undefined && value > maximum) {
		return { error: { key: 'UNBOUND_SETTING_TOO_LARGE', vars: { maximum } } };
	}

	const ratio = step === undefined ? 0 : value / step;

	if (Math.abs(ratio - Math.round(ratio)) > 1e-9) {
		return { error: { key: 'UNBOUND_SETTING_NOT_A_MULTIPLE', vars: { step: step ?? 1 } } };
	}

	return { value };
}

/** A duration unit, smallest first. */
export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd';

/** A duration in one unit. */
export type DurationSplit = { amount: number; unit: DurationUnit };

/** How many milliseconds each unit is. */
export const UNIT_MS: Record<DurationUnit, number> = {
	ms: 1,
	s: 1000,
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
};

/**
 * @description Writes a duration in the largest of the units that divides it exactly, so `90000` reads as 90 seconds and `120000` as 2 minutes.
 * @param ms The duration, in milliseconds.
 * @param units The units offered, smallest first.
 * @returns The amount and its unit.
 */
export function splitDuration(ms: number, units: DurationUnit[]): DurationSplit {
	const unit = units.toReversed().find((each) => ms % UNIT_MS[each] === 0) ?? units[0] ?? 'ms';

	return { amount: ms / UNIT_MS[unit], unit };
}
