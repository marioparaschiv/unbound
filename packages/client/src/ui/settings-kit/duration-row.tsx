import { useEffect, useState, type ReactElement } from 'react';

import { splitDuration, UNIT_MS, type DurationUnit } from '~/ui/settings-kit/number-input';
import SegmentedRow from '~/ui/settings-kit/segmented-row';
import NumberRow from '~/ui/settings-kit/number-row';
import { messages } from '~/i18n/api';

/** Props for `DurationRow`. */
export type DurationRowProps = {
	/** The row's label. */
	label: string;
	/** Text shown under the input; none when omitted. */
	subLabel?: string;
	/** The saved duration, in milliseconds. */
	value: number;
	/** The shortest duration, in milliseconds; none when omitted. */
	minimum?: number;
	/** The longest duration, in milliseconds; none when omitted. */
	maximum?: number;
	/** The units offered, smallest first; seconds, minutes and hours when omitted. */
	units?: DurationUnit[];
	/** Dims the row and ignores input. Defaults to false. */
	disabled?: boolean;
	/** Called with the new duration, in milliseconds. */
	onChange: (value: number) => void;
};

const DEFAULT_UNITS: DurationUnit[] = ['s', 'm', 'h'];

const UNIT_LABELS: Record<DurationUnit, keyof typeof messages> = {
	ms: 'UNBOUND_UNIT_MILLISECONDS',
	s: 'UNBOUND_UNIT_SECONDS',
	m: 'UNBOUND_UNIT_MINUTES',
	h: 'UNBOUND_UNIT_HOURS',
	d: 'UNBOUND_UNIT_DAYS',
};

/**
 * @description A settings input for a duration: an amount, and the unit it is in. The duration saves in milliseconds.
 * @param props The row's label, saved duration, range, units and change handler.
 * @returns The row.
 */
function DurationRow({
	label,
	subLabel,
	value,
	minimum,
	maximum,
	units = DEFAULT_UNITS,
	disabled = false,
	onChange,
}: DurationRowProps): ReactElement {
	const split = splitDuration(value, units);
	const [unit, setUnit] = useState(split.unit);
	const scale = UNIT_MS[unit];

	useEffect(() => setUnit(splitDuration(value, units).unit), [value]);

	return (
		<>
			<NumberRow
				label={label}
				subLabel={subLabel}
				value={value / scale}
				minimum={minimum === undefined ? undefined : minimum / scale}
				maximum={maximum === undefined ? undefined : maximum / scale}
				disabled={disabled}
				onChange={(amount) => onChange(Math.round(amount * scale))}
			/>
			<SegmentedRow
				label={messages.UNBOUND_UNIT}
				value={unit}
				options={units.map((each) => ({ value: each, label: messages[UNIT_LABELS[each]] }))}
				disabled={disabled}
				onChange={(next) => setUnit(units.find((each) => each === next) ?? unit)}
			/>
		</>
	);
}

export default DurationRow;
