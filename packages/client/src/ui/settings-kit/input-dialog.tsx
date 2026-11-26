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

/** Props for `InputDialog`: its options and a way to close it. */
export type InputDialogProps = InputDialogOptions & DialogContentProps;

/**
 * @description A text input dialog in Discord's alert: one focused input and its error, then Save, which writes once
 * and closes, and Cancel. A multiline value uses Discord's `TextArea`, which reports text through `onChange` and
 * shows a counter for `maxLength`.
 */
function InputDialog({
	label,
	subLabel,
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

	const input =
		variant === 'multiline' && Discord.TextArea ? (
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
		);

	// Save sits in `actions` beside Cancel, spaced as Discord spaces its own dialog buttons.
	return (
		<Discord.AlertModal
			title={label}
			content={subLabel}
			extraContent={<View style={styles.content}>{input}</View>}
			actions={
				<>
					<Discord.AlertActionButton
						text={messages.UNBOUND_SAVE}
						variant='primary'
						onPress={submit}
					/>
					<Discord.AlertActionButton
						text={messages.UNBOUND_CANCEL}
						variant='secondary'
						onPress={dismiss}
					/>
				</>
			}
		/>
	);
}

/**
 * @description Asks for text in Discord's alert dialog, titled with the label and described by the sub-label. The
 * input is focused as it opens; Save writes once, Cancel closes without writing.
 * @param options The dialog's label, starting text, input variant, validation and save handler.
 */
export function openInputDialog(options: InputDialogOptions): void {
	showDialog({
		title: options.label,
		body: options.subLabel,
		modal: ({ dismiss }) => <InputDialog {...options} dismiss={dismiss} />,
		cancel: messages.UNBOUND_CANCEL,
	});
}

export default InputDialog;
