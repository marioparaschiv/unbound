import { View, type TextInputChangeEvent } from 'react-native';
import type { ReactElement } from 'react';

import { BottomSheets, Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import type { InputVariant, InputKeyboard } from './input-row';

import useInputDraft from './use-input-draft';
import useStyles from './input-sheet.style';

/** What Discord's `TextArea` passes `onChange`: on device a plain string, typed as React Native's change event. */
type TextChange = string | TextInputChangeEvent;

function textOf(change: TextChange): string {
	return typeof change === 'string' ? change : change.nativeEvent.text;
}

/** Props for `InputSheet`. */
export type InputSheetProps = {
	label: string;
	subLabel?: string;
	value: string;
	placeholder?: string;
	variant: InputVariant;
	keyboardType: InputKeyboard;
	maxLength?: number;
	validate?: (text: string) => string | undefined;
	onChange: (text: string) => void;
	onClose: () => void;
};

/**
 * @description Discord's titled action sheet holding one text input, its label, description and error, and a Save
 * button that writes once. A multiline value uses Discord's `TextArea`, which reports text through `onChange`
 * and shows a counter for `maxLength`.
 */
function InputSheet({
	label,
	subLabel,
	value,
	placeholder,
	variant,
	keyboardType,
	maxLength,
	validate,
	onChange,
	onClose,
}: InputSheetProps): ReactElement {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { draft, error, setDraft, save } = useInputDraft(value, onChange, validate);

	function submit() {
		if (save()) {
			onClose();
		}
	}

	const props = {
		value: draft,
		placeholder,
		maxLength,
		autoFocus: true,
		autoCapitalize: 'none',
		autoCorrect: false,
		status: error ? 'error' : undefined,
		errorMessage: error,
	} as const;

	return (
		<ActionSheet>
			<BottomSheetTitleHeader title={label} subtitle={subLabel} />
			<View style={styles.content}>
				{variant === 'multiline' && Discord.TextArea ? (
					<Discord.TextArea
						{...props}
						onChange={(change: TextChange) => setDraft(textOf(change))}
					/>
				) : (
					<Discord.TextInput
						{...props}
						keyboardType={keyboardType}
						secureTextEntry={variant === 'secret'}
						onChange={setDraft}
						onSubmitEditing={submit}
					/>
				)}
				<Discord.Button text={messages.UNBOUND_SAVE} variant='primary' onPress={submit} />
			</View>
		</ActionSheet>
	);
}

export default InputSheet;
