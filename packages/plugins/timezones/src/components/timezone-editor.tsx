import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { useState } from 'react';

import { isTimezone } from '~/lib/zones';

type TimezoneEditorProps = {
	initialValue: string;
	onClose: () => void;
	onSave: (zone: string | undefined) => void;
};

function TimezoneEditor({ initialValue, onClose, onSave }: TimezoneEditorProps) {
	const [value, setValue] = useState(initialValue);
	const zone = value.trim();
	const invalid = zone.length > 0 && !isTimezone(zone);

	return (
		<Discord.Stack spacing={12}>
			<Discord.TextInput
				label={messages.TIMEZONE}
				placeholder={messages.TIMEZONE_PLACEHOLDER}
				autoCapitalize='none'
				autoCorrect={false}
				value={value}
				onChange={setValue}
				{...(invalid ? { errorMessage: format('INVALID_TIMEZONE', { zone }) } : {})}
			/>
			<Discord.Stack direction='horizontal' spacing={12}>
				<Discord.Button
					grow
					variant='secondary'
					text={messages.CLEAR}
					onPress={() => {
						onSave(undefined);
						onClose();
					}}
				/>
				<Discord.Button
					grow
					variant='primary'
					text={messages.SAVE}
					disabled={!zone || invalid}
					onPress={() => {
						onSave(zone);
						onClose();
					}}
				/>
			</Discord.Stack>
		</Discord.Stack>
	);
}

export default TimezoneEditor;
