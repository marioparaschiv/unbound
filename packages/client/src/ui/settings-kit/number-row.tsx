import type { ReactElement } from 'react';

import { parseNumberInput, type NumberConstraints } from '~/ui/settings-kit/number-input';
import InputRow from '~/ui/settings-kit/input-row';
import { format } from '~/i18n/api';

/** Props for `NumberRow`. */
export type NumberRowProps = NumberConstraints & {
	/** The input's label. */
	label: string;
	/** Text shown under the input; none when omitted. */
	subLabel?: string;
	/** The saved number. */
	value: number;
	disabled?: boolean;
	/** Called with the typed number when editing ends and it meets the constraints. */
	onChange: (value: number) => void;
};

/**
 * @description A settings input for a number with no slider range, checked against whether it must be whole, its range and its step before it saves.
 * @param props The input's label, saved number, constraints and change handler.
 * @returns The input.
 */
function NumberRow({
	label,
	subLabel,
	value,
	disabled = false,
	onChange,
	...constraints
}: NumberRowProps): ReactElement {
	const negative = constraints.minimum === undefined || constraints.minimum < 0;

	function validate(text: string) {
		const result = parseNumberInput(text, constraints);

		return 'error' in result ? format(result.error.key, result.error.vars) : undefined;
	}

	function save(text: string) {
		const result = parseNumberInput(text, constraints);

		if ('value' in result) {
			onChange(result.value);
		}
	}

	return (
		<InputRow
			label={label}
			subLabel={subLabel}
			value={String(value)}
			disabled={disabled}
			keyboardType={
				negative
					? 'numbers-and-punctuation'
					: constraints.integer
						? 'number-pad'
						: 'decimal-pad'
			}
			validate={validate}
			onChange={save}
		/>
	);
}

export default NumberRow;
