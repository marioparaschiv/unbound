import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';
import { View } from 'react-native';
import { useState } from 'react';

import { spell, type Spelling } from '~/lib/letters';
import { addReactions } from '~/lib/react';

type Target = { channelId: string; messageId: string; taken: string[] };

type SpellSheetProps = Target & { onClose: () => void };

function problem(spelling: Spelling): string | undefined {
	if (spelling.ok) return undefined;

	switch (spelling.reason) {
		case 'empty':
			return messages.EMPTY;
		case 'unsupported':
			return format('UNSUPPORTED', { characters: spelling.characters.join(' ') });
		case 'repeats':
			return format('CANNOT_SPELL', { letters: spelling.letters.join(', ') });
		default:
			return format('TOO_MANY', { count: spelling.count });
	}
}

function SpellSheet({ channelId, messageId, taken, onClose }: SpellSheetProps) {
	const [word, setWord] = useState('');
	const spelling = spell(word, new Set(taken));
	const preview = spelling.ok ? spelling.emoji.join(' ') : problem(spelling);

	async function react() {
		if (!spelling.ok) return;

		onClose();

		const added = await addReactions(channelId, messageId, spelling.emoji);

		if (added === spelling.emoji.length) toasts.success('ADDED', { word: word.trim() });
		else toasts.warning('FAILED', { count: added });
	}

	return (
		<Discord.ActionSheet>
			<View style={{ gap: 12, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>{messages.SPELL}</Discord.Text>
				<Discord.TextInput
					description={messages.HELP}
					autoCorrect={false}
					autoCapitalize='none'
					value={word}
					onChange={setWord}
				/>
				{word.trim() ? (
					<Discord.Text variant='text-md/medium'>{preview}</Discord.Text>
				) : null}
				<Discord.Button
					text={messages.REACT}
					disabled={!spelling.ok}
					onPress={() => void react()}
				/>
			</View>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that spells a word on a message with reactions.
 * @param target The message, its channel, and the emoji already on it.
 */
export function openSpellSheet(target: Target): void {
	openSheet(`unbound-spell-with-reactions-${target.messageId}`, SpellSheet, target);
}

export default SpellSheet;
