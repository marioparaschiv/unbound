import { Discord } from '@unbound-app/api/metro/components';
import { Pressable, ScrollView, View } from 'react-native';
import { messages } from '@unbound-app/i18n';
import { metro, toasts } from '@unbound-app/api';
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
		<View style={{ gap: 4 }}>
			<Discord.Text variant='text-sm/medium' color='text-muted'>
				{messages.TAP_TO_PLAY}
			</Discord.Text>
			{segments.map((segment, index) => (
				<Pressable
					key={index}
					accessibilityRole='button'
					onPress={() => void play(index)}
					style={({ pressed }) => ({
						flexDirection: 'row',
						gap: 12,
						paddingVertical: 8,
						paddingHorizontal: 8,
						borderRadius: 8,
						opacity: pressed ? 0.6 : 1,
						backgroundColor:
							index === playing ? 'rgba(88, 101, 242, 0.18)' : 'transparent',
					})}
				>
					<Discord.Text
						variant='text-sm/semibold'
						color='text-link'
						style={{ minWidth: 40 }}
					>
						{formatTime(segment.start)}
					</Discord.Text>
					<Discord.Text variant='text-md/normal' color='text-default' style={{ flex: 1 }}>
						{segment.text}
					</Discord.Text>
				</Pressable>
			))}
			<Discord.Button
				text={messages.STOP}
				variant='secondary'
				onPress={() => {
					setPlaying(undefined);
					void player.stop();
				}}
			/>
		</View>
	);
}

function TranscriptPage({ text, segments, player }: TranscriptPageProps) {
	return (
		<ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
			{segments?.length && player ? (
				<Passages segments={segments} player={player} />
			) : (
				<View>
					<Discord.Text variant='text-md/normal' color='text-default' selectable>
						{text}
					</Discord.Text>
				</View>
			)}
			<Discord.Button
				text={messages.COPY}
				onPress={() => {
					Clipboard?.setString(text);
					toasts.show({ title: addon.name, content: messages.COPIED });
				}}
			/>
		</ScrollView>
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
