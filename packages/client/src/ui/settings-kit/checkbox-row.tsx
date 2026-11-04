import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';

/** Props for `CheckboxRow`. */
export type CheckboxRowProps = {
	/** The row's label. */
	label: string;
	/** Text shown under the label; none when omitted. */
	subLabel?: string;
	/** Whether the box is checked. */
	value: boolean;
	disabled?: boolean;
	/** Called with the new state when the row is pressed. */
	onValueChange: (value: boolean) => void;
};

/**
 * @description A settings row with a checkbox, Discord's `TableCheckboxRow`.
 * @param props The row's label, state and change handler.
 * @returns The row.
 */
function CheckboxRow({
	label,
	subLabel,
	value,
	disabled = false,
	onValueChange,
}: CheckboxRowProps): ReactElement {
	return (
		<Discord.TableCheckboxRow
			label={label}
			subLabel={subLabel}
			checked={value}
			disabled={disabled}
			onPress={() => onValueChange(!value)}
		/>
	);
}

export default CheckboxRow;
