import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';
import { View } from 'react-native';

import { defaultName, type Session } from '~/lib/sessions';
import { nameSession, sessionNames } from '~/lib/store';

import styles from '~/components/rename-sheet.style';

const SHEET_KEY = 'unbound-better-sessions-rename';

type RenameSheetProps = { session: Session; onRenamed: () => void };

function RenameSheet({ session, onRenamed }: RenameSheetProps) {
	const [name, setName] = useState(sessionNames()[session.id_hash] ?? '');

	function save(value: string) {
		nameSession(session.id_hash, value);
		metro.api.ActionSheets.hideActionSheet(SHEET_KEY);
		onRenamed();
	}

	return (
		<Discord.ActionSheet>
			<View style={styles.content}>
				<Discord.Text variant='heading-md/semibold'>{messages.RENAME_TITLE}</Discord.Text>
				<Discord.TextField
					value={name}
					onChange={setName}
					placeholder={defaultName(session)}
					isClearable
				/>
				<Discord.Button text={messages.SAVE} onPress={() => save(name)} />
				<Discord.Button
					variant='secondary'
					text={messages.RESET}
					onPress={() => save('')}
				/>
			</View>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens a sheet to name a session.
 * @param session The session.
 * @param onRenamed Runs once the name is saved, to show it.
 */
export function openRenameSheet(session: Session, onRenamed: () => void): void {
	metro.api.ActionSheets.openLazy(
		Promise.resolve({ default: () => <RenameSheet session={session} onRenamed={onRenamed} /> }),
		SHEET_KEY,
	);
}
