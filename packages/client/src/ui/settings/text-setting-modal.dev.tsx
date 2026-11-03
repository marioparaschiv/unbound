import { useState } from 'react';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import useStyles from './text-setting-modal.style';

type TextSettingModalProps = {
	title: string;
	description?: string;
	value: string;
	placeholder: string;
	/** Shown under the field when `validate` rejects the draft. */
	invalidMessage?: string;
	/** Whether a non-empty draft can be saved; any draft can when omitted. */
	validate?: (value: string) => boolean;
	/** Called with the trimmed draft, or `''` to restore the default. */
	onSave: (value: string) => void;
	onClose: () => void;
};

/**
 * @description An alert that edits one text setting: Save keeps the trimmed draft, Reset clears it.
 */
function TextSettingModal({
	title,
	description,
	value,
	placeholder,
	invalidMessage,
	validate,
	onSave,
	onClose,
}: TextSettingModalProps) {
	const styles = useStyles();
	const [draft, setDraft] = useState(value);
	const trimmed = draft.trim();
	const invalid = Boolean(trimmed && validate && !validate(trimmed));

	function save(next: string) {
		onSave(next);
		onClose();
	}

	return (
		<Discord.AlertModal
			title={title}
			content={description}
			extraContent={
				<>
					<Discord.TextField
						value={draft}
						placeholder={placeholder}
						autoFocus
						autoCapitalize='none'
						autoCorrect={false}
						status={invalid ? 'error' : 'default'}
						onChange={setDraft}
						onSubmitEditing={() => (invalid ? null : save(trimmed))}
					/>
					{invalid && invalidMessage ? (
						<Discord.Text variant='text-xs/medium' style={styles.error}>
							{invalidMessage}
						</Discord.Text>
					) : null}
				</>
			}
			actions={
				<>
					<Discord.AlertActionButton
						text={messages.UNBOUND_SAVE}
						variant='primary'
						disabled={invalid}
						onPress={() => save(trimmed)}
					/>
					{value ? (
						<Discord.AlertActionButton
							text={messages.UNBOUND_RESET}
							variant='secondary'
							onPress={() => save('')}
						/>
					) : null}
					<Discord.AlertActionButton
						text={messages.UNBOUND_CANCEL}
						variant='secondary'
						onPress={onClose}
					/>
				</>
			}
		/>
	);
}

export default TextSettingModal;
