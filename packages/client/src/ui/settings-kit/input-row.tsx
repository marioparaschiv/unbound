import type { ReactElement } from 'react';

import { Discord } from '~/metro/components';
import { ActionSheets } from '~/metro/api';

import InputSheet from './input-sheet';

/** How an input shows its text. */
export type InputVariant = 'text' | 'multiline' | 'secret';

/** The keyboard an input opens. */
export type InputKeyboard =
	| 'default'
	| 'number-pad'
	| 'decimal-pad'
	| 'numbers-and-punctuation'
	| 'url';

/** Props for `InputRow`. */
export type InputRowProps = {
	/** The input's label. */
	label: string;
	/** Text shown under the input; none when omitted. */
	subLabel?: string;
	/** The saved text; the input follows it whenever it changes. */
	value: string;
	/** Text shown while the input is empty. */
	placeholder?: string;
	/** `text` is one line, `multiline` grows with its text, `secret` hides what is typed. */
	variant?: InputVariant;
	/** The keyboard the input opens; `default` when omitted. */
	keyboardType?: InputKeyboard;
	/** The most characters the input takes. */
	maxLength?: number;
	/** Draws the input greyed out and ignores typing. */
	disabled?: boolean;
	/** Returns why the typed text cannot be saved, or `undefined` when it can. */
	validate?: (text: string) => string | undefined;
	/** Called with the typed text when editing ends and `validate` accepts it. */
	onChange: (text: string) => void;
};

const SHEET_KEY = 'UnboundSettingInput';
const SECRET_MASK = '••••••••';

function shown(value: string, variant: InputVariant): string {
	if (!value) {
		return '';
	}

	if (variant === 'secret') {
		return SECRET_MASK;
	}

	// A multiline value shows its first line, as Discord's rows show one line of trailing text.
	return variant === 'multiline' ? (value.split('\n')[0] ?? '') : value;
}

/**
 * @description A settings row, Discord's way: the label, and the saved text trailing (masked when secret). Pressing
 * it opens Discord's titled action sheet with the input, its description and error, which saves only on Save.
 * @param props The row's label, saved text, variant, validation and change handler.
 * @returns The row.
 */
function InputRow({
	label,
	subLabel,
	value,
	placeholder,
	variant = 'text',
	keyboardType = 'default',
	maxLength,
	disabled = false,
	validate,
	onChange,
}: InputRowProps): ReactElement {
	function open() {
		ActionSheets.openLazy(Promise.resolve({ default: InputSheet }), SHEET_KEY, {
			label,
			subLabel,
			value,
			placeholder,
			variant,
			keyboardType,
			maxLength,
			validate,
			onChange,
			onClose: () => ActionSheets.hideActionSheet(SHEET_KEY),
		});
	}

	return (
		<Discord.TableRow
			label={label}
			subLabel={subLabel}
			trailing={
				<Discord.TableRowTrailingText text={shown(value, variant) || placeholder || ''} />
			}
			arrow
			disabled={disabled}
			onPress={open}
		/>
	);
}

export default InputRow;
