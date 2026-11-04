import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';

type UserIdEditorProps = {
	initialValue: string;
	onCancel: () => void;
	onSave: (value: string) => void;
};

function UserIdEditor({ initialValue, onCancel, onSave }: UserIdEditorProps) {
	const [value, setValue] = useState(initialValue);

	return (
		<Discord.Stack spacing={12}>
			<Discord.TextInput
				label={initialValue ? messages.EDIT_USER_ID : messages.ADD_USER_ID}
				placeholder={messages.USER_ID_PLACEHOLDER}
				keyboardType='number-pad'
				autoCapitalize='none'
				autoCorrect={false}
				value={value}
				onChange={setValue}
			/>
			<Discord.Stack direction='horizontal' spacing={12}>
				<Discord.Button
					grow
					variant='secondary'
					text={messages.CANCEL}
					onPress={onCancel}
				/>
				<Discord.Button
					grow
					variant='primary'
					text={messages.SAVE}
					onPress={() => onSave(value)}
				/>
			</Discord.Stack>
		</Discord.Stack>
	);
}

export default UserIdEditor;
