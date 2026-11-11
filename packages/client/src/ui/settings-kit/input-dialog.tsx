import { View, type TextInputChangeEvent } from 'react-native';
import type { ReactElement } from 'react';

import { showDialog, type DialogContentProps } from '~/dialogs/api';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import type { InputVariant, InputKeyboard } from './input-row';

import useInputDraft from './use-input-draft';
import useStyles from './input-dialog.style';

/** What Discord's `TextArea` passes `onChange`: on device a plain string, typed as React Native's change event. */
type TextChange = string | TextInputChangeEvent;

function textOf(change: TextChange): string {
	return typeof change === 'string' ? change : change.nativeEvent.text;
}

/** What `openInputDialog` asks for. */
export type InputDialogOptions = {
	label: string;
	subLabel?: string;
	value: string;
	placeholder?: string;
	variant: InputVariant;
	keyboardType: InputKeyboard;
	maxLength?: number;
	validate?: (text: string) => string | undefined;
	onChange: (text: string) => void;
};

/** Props for `InputDialog`: the options below the dialog's title and description. */
export type InputDialogProps = Omit<InputDialogOptions, 'label' | 'subLabel'> & DialogContentProps;

/**
 * @description The body of a text input dialog: one focused input, its error, and a Save button that writes once
 * and closes the dialog. A multiline value uses Discord's `TextArea`, which reports text through `onChange` and
 * shows a counter for `maxLength`.
 */
function InputDialog({
	value,
	placeholder,
	variant,
	keyboardType,
	maxLength,
	validate,
	onChange,
	dismiss,
}: InputDialogProps): ReactElement {
	const styles = useStyles();
	const { draft, error, setDraft, save } = useInputDraft(value, onChange, validate);

	function submit() {
		if (save()) {
			dismiss();
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
	);
}

/**
 * @description Asks for text in Discord's alert dialog, titled with the label and described by the sub-label. The
 * input is focused as it opens; Save writes once, Cancel closes without writing.
 * @param options The dialog's label, starting text, input variant, validation and save handler.
 */
export function openInputDialog({ label, subLabel, ...input }: InputDialogOptions): void {
	showDialog({
		title: label,
		body: subLabel,
		content: ({ dismiss }) => <InputDialog {...input} dismiss={dismiss} />,
		cancel: messages.UNBOUND_CANCEL,
	});
}

export default InputDialog;
