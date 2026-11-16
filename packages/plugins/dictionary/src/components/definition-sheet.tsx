import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { Discord } from '@unbound-app/api/metro/components';
import { assets, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { toggleWord, useVocabulary } from '~/lib/vocabulary';
import { playPronunciation } from '~/lib/player';
import type { Entry } from '~/lib/definitions';
import { readerLanguage } from '~/lib/language';
import { findRecording } from '~/lib/pronunciation';
import { lookUp } from '~/lib/lookup';

type DefinitionSheetProps = { word: string; onClose: () => void };

type Lookup = { state: 'loading' } | { state: 'missing' } | { state: 'found'; entry: Entry };

function Meanings({ entry }: { entry: Entry }) {
	return (
		<View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12 }}>
			{entry.meanings.map((meaning, index) => (
				<View key={index} style={{ gap: 4 }}>
					<Discord.Text variant='text-sm/semibold' color='text-muted'>
						{meaning.partOfSpeech}
					</Discord.Text>
					{meaning.senses.map((sense, position) => (
						<View key={position} style={{ gap: 2 }}>
							<Discord.Text variant='text-md/normal'>{`${position + 1}. ${sense.definition}`}</Discord.Text>
							{sense.example ? (
								<Discord.Text variant='text-sm/normal' color='text-muted'>
									{format('EXAMPLE', { example: sense.example })}
								</Discord.Text>
							) : null}
						</View>
					))}
				</View>
			))}
			<Discord.Text variant='text-xs/normal' color='text-muted'>
				{format('SOURCE', { source: entry.source })}
			</Discord.Text>
		</View>
	);
}

async function play(entry: Entry) {
	const recording = await findRecording(entry.word, readerLanguage());
	const urls = [recording, entry.audio].filter((url): url is string => Boolean(url));

	if (!(await playPronunciation(urls))) toasts.info('NO_RECORDING');
}

/**
 * @description Looks a word up and shows its pronunciation, definitions and examples, with buttons to play the
 * pronunciation and to save the word.
 * @param props The word.
 * @returns The sheet.
 */
export default function DefinitionSheet({ word }: DefinitionSheetProps) {
	const [lookup, setLookup] = useState<Lookup>({ state: 'loading' });
	const vocabulary = useVocabulary();
	const ActionSheetRow = getActionSheetRow();
	const saved = vocabulary.some((entry) => entry.word === word);
	const speaker = assets.getIdByName('VoiceNormalIcon');
	const star =
		assets.getIdByName(saved ? 'StarIcon' : 'StarOutlineIcon') ??
		assets.getIdByName('StarIcon');

	useEffect(() => {
		let current = true;

		lookUp(word, readerLanguage())
			.then(
				(entry) =>
					current && setLookup(entry ? { state: 'found', entry } : { state: 'missing' }),
			)
			.catch(() => current && setLookup({ state: 'missing' }));

		return () => {
			current = false;
		};
	}, [word]);

	const entry = lookup.state === 'found' ? lookup.entry : undefined;

	return (
		<Discord.ActionSheet>
			<View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 2 }}>
				<Discord.Text variant='heading-xl/bold'>{entry?.word ?? word}</Discord.Text>
				{entry?.phonetic ? (
					<Discord.Text variant='text-md/normal' color='text-muted'>
						{entry.phonetic}
					</Discord.Text>
				) : null}
			</View>
			{lookup.state === 'loading' ? (
				<Discord.Text variant='text-md/normal' color='text-muted' style={{ padding: 16 }}>
					{messages.LOADING}
				</Discord.Text>
			) : null}
			{lookup.state === 'missing' ? (
				<Discord.Text variant='text-md/normal' color='text-muted' style={{ padding: 16 }}>
					{messages.NOT_FOUND}
				</Discord.Text>
			) : null}
			{entry ? <Meanings entry={entry} /> : null}
			{entry ? (
				<ActionSheetRow.Group>
					<ActionSheetRow
						label={messages.PLAY}
						icon={speaker ? <ActionSheetRow.Icon source={speaker} /> : undefined}
						onPress={() => void play(entry)}
					/>
					<ActionSheetRow
						label={saved ? messages.SAVED : messages.SAVE}
						icon={star ? <ActionSheetRow.Icon source={star} /> : undefined}
						onPress={() => {
							const nowSaved = toggleWord(
								word,
								entry.meanings[0]?.senses[0]?.definition ?? '',
							);

							if (!nowSaved) toasts.info('REMOVED');
						}}
					/>
				</ActionSheetRow.Group>
			) : null}
		</Discord.ActionSheet>
	);
}
