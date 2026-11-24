import { openSheet, type SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';
import { View } from 'react-native';

import { defaultName, type Session } from '~/lib/sessions';
import { nameSession, sessionNames } from '~/lib/store';

import useStyles from '~/components/rename-sheet.style';

type RenameSheetProps = SheetProps & { session: Session; onRenamed: () => void };

function RenameSheet({ session, onRenamed, onClose }: RenameSheetProps) {
	const styles = useStyles();
	const [name, setName] = useState(sessionNames()[session.id_hash] ?? '');

	function save(value: string) {
		nameSession(session.id_hash, value);
		onClose();
		onRenamed();
	}

	return (
		<Discord.ActionSheet>
			<Discord.BottomSheetTitleHeader title={messages.RENAME_TITLE} />
			<View style={styles.content}>
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
	openSheet('unbound-better-sessions-rename', RenameSheet, { session, onRenamed });
}
