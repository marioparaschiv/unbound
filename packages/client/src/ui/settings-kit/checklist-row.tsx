import type { ReactElement } from 'react';

import type { ChoiceOption } from '~/ui/settings-kit/radio-row';
import { Discord } from '~/metro/components';

/** Props for `ChecklistRow`. */
export type ChecklistRowProps = {
	/** The group's title. */
	title: string;
	/** Text shown under the group; none when omitted. */
	description?: string;
	/** The checked values. */
	value: string[];
	/** The options, in order. */
	options: ChoiceOption[];
	/** The most options that can be checked; none when omitted. */
	maxItems?: number;
	/** Dims the row and ignores input. Defaults to false. */
	disabled?: boolean;
	/** Called with the checked values, in the options' order, after each press. */
	onChange: (value: string[]) => void;
};

/**
 * @description A titled group of checkbox rows, one per option, for picking several.
 * @param props The group's title, checked values, options and change handler.
 * @returns The group.
 */
function ChecklistRow({
	title,
	description,
	value,
	options,
	maxItems = Infinity,
	disabled = false,
	onChange,
}: ChecklistRowProps): ReactElement {
	function toggle(option: string) {
		const checked = value.includes(option);

		onChange(
			options
				.map(({ value: each }) => each)
				.filter((each) => (each === option ? !checked : value.includes(each))),
		);
	}

	return (
		<Discord.TableRowGroup title={title} description={description}>
			{options.map((option) => {
				const checked = value.includes(option.value);

				return (
					<Discord.TableCheckboxRow
						key={option.value}
						label={option.label}
						subLabel={option.subLabel}
						checked={checked}
						disabled={disabled || (!checked && value.length >= maxItems)}
						onPress={() => toggle(option.value)}
					/>
				);
			})}
		</Discord.TableRowGroup>
	);
}

export default ChecklistRow;
