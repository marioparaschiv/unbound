import { Discord } from '@unbound-app/api/metro/components';
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
				label={initialValue ? 'Edit user ID' : 'Add user ID'}
				placeholder='Discord user ID'
				keyboardType='number-pad'
				autoCapitalize='none'
				autoCorrect={false}
				value={value}
				onChange={setValue}
			/>
			<Discord.Stack direction='horizontal' spacing={12}>
				<Discord.Button grow variant='secondary' text='Cancel' onPress={onCancel} />
				<Discord.Button grow variant='primary' text='Save' onPress={() => onSave(value)} />
			</Discord.Stack>
		</Discord.Stack>
	);
}

export default UserIdEditor;
