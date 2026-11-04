import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';

/** One option of a choice row. */
export type ChoiceOption = {
	/** The value saved when the option is picked. */
	value: string;
	/** The option's label. */
	label: string;
	/** Text shown under the label; only `RadioRow` draws it. */
	subLabel?: string;
};

/** Props for `RadioRow`. */
export type RadioRowProps = {
	/** The group's title. */
	title: string;
	/** Text shown under the group; none when omitted. */
	description?: string;
	/** The picked value. */
	value: string;
	/** The options, in order. */
	options: ChoiceOption[];
	/** Draws the options greyed out and ignores presses. */
	disabled?: boolean;
	/** Called with the value of the option the user picks. */
	onChange: (value: string) => void;
};

/**
 * @description A titled group of radio rows, one per option with its sub-label, Discord's `TableRadioGroup` as its appearance settings use it.
 * @param props The group's title, picked value, options and change handler.
 * @returns The group.
 */
function RadioRow({
	title,
	description,
	value,
	options,
	disabled = false,
	onChange,
}: RadioRowProps): ReactElement {
	return (
		<Discord.TableRadioGroup
			title={title}
			description={description}
			value={value}
			onChange={(picked: string) => onChange(picked)}
		>
			{options.map((option) => (
				<Discord.TableRadioRow
					key={option.value}
					label={option.label}
					subLabel={option.subLabel}
					value={option.value}
					disabled={disabled}
				/>
			))}
		</Discord.TableRadioGroup>
	);
}

export default RadioRow;
