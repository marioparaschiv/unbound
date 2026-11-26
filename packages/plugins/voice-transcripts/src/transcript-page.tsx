import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { assets, metro, toasts, ui } from '@unbound-app/api';
import { useEffect, useState } from 'react';

import { formatTime, type TranscriptSegment } from '~/lib/segments';
import type { SegmentPlayer } from '~/native/segment-player';

const PAGE_ROUTE = 'UNBOUND_CUSTOM';

type Clipboard = { setString(text: string): void };

type TranscriptPageProps = {
	text: string;
	segments?: TranscriptSegment[];
	player?: SegmentPlayer;
};

type PassagesProps = { segments: TranscriptSegment[]; player: SegmentPlayer };

const Clipboard: Clipboard | undefined = metro.findByProps('setString', 'getString', {
	lazy: true,
});

function Passages({ segments, player }: PassagesProps) {
	const [playing, setPlaying] = useState<number | undefined>();

	useEffect(() => () => void player.stop(), [player]);

	async function play(index: number) {
		setPlaying(index);

		if (!(await player.playFrom(segments[index]!.start))) {
			setPlaying(undefined);
			toasts.show({ title: addon.name, content: messages.PLAY_FAILED });
		}
	}

	return (
		<>
			<ui.Section description={messages.TAP_TO_PLAY} hasIcons>
				{segments.map((segment, index) => (
					<ui.Row
						key={index}
						label={segment.text}
						subLabel={formatTime(segment.start)}
						icon={assets.getIdByName(
							index === playing ? 'VoiceNormalIcon' : 'PlayIcon',
						)}
						onPress={() => void play(index)}
					/>
				))}
			</ui.Section>
			<ui.Section hasIcons>
				<ui.Row
					label={messages.STOP}
					icon={assets.getIdByName('StopIcon')}
					disabled={playing === undefined}
					onPress={() => {
						setPlaying(undefined);
						void player.stop();
					}}
				/>
			</ui.Section>
		</>
	);
}

function TranscriptPage({ text, segments, player }: TranscriptPageProps) {
	return (
		<ui.Page>
			{segments?.length && player ? (
				<Passages segments={segments} player={player} />
			) : (
				<Discord.Text variant='body-md/normal' color='text-default' selectable>
					{text}
				</Discord.Text>
			)}
			<ui.Section hasIcons>
				<ui.Row
					label={messages.COPY}
					icon={assets.getIdByName('CopyIcon')}
					onPress={() => {
						Clipboard?.setString(text);
						toasts.show({ title: addon.name, content: messages.COPIED });
					}}
				/>
			</ui.Section>
		</ui.Page>
	);
}

/**
 * @description Shows a transcript on its own page with a button that copies it. With timed passages and a player,
 * tapping a passage plays the audio from there; otherwise the text is selectable.
 * @param props The transcript, its passages and the player that seeks to them.
 */
export function openTranscript(props: TranscriptPageProps): void {
	metro
		.findByProps('getRootNavigationRef')
		?.getRootNavigationRef()
		.navigate('settings', {
			screen: PAGE_ROUTE,
			params: { title: messages.TRANSCRIPT, render: () => <TranscriptPage {...props} /> },
		});
}

export default openTranscript;
