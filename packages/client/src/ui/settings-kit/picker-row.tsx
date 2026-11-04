import type { ReactElement } from 'react';

import type { ChoiceOption } from '~/ui/settings-kit/radio-row';
import { Discord } from '~/metro/components';

/** Props for `PickerRow`. */
export type PickerRowProps = {
	/** The row's label. */
	label: string;
	/** The picked value. */
	value: string;
	/** The options, in order; their sub-labels are not drawn. */
	options: ChoiceOption[];
	disabled?: boolean;
	/** Called with the value of the option the user picks. */
	onChange: (value: string) => void;
};

/**
 * @description A row showing the picked option that opens Discord's action sheet listing every option, for choices too many for a radio group.
 * @param props The row's label, picked value, options and change handler.
 * @returns The row.
 */
function PickerRow({
	label,
	value,
	options,
	disabled = false,
	onChange,
}: PickerRowProps): ReactElement {
	const picked = options.find((option) => option.value === value);

	function open() {
		Discord.showSimpleActionSheet({
			key: `unbound-picker-${label}`,
			header: { title: label },
			options: options.map((option) => ({
				label: option.label,
				onPress: () => onChange(option.value),
			})),
		});
	}

	return (
		<Discord.TableRow
			label={label}
			trailing={<Discord.TableRowTrailingText text={picked?.label ?? value} />}
			arrow
			disabled={disabled}
			onPress={open}
		/>
	);
}

export default PickerRow;
