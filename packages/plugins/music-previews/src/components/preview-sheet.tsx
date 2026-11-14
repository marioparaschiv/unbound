import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import useStyles from '~/components/preview-sheet.style';
import type { MusicCollection, PreviewTrack } from '~/lib/collection';
import { searchPreview } from '~/lib/itunes';
import { loadCollection } from '~/lib/load-collection';
import type { MusicLink } from '~/lib/music-link';
import { playPreview, stopPreview } from '~/lib/player';

/** Props of {@link PreviewSheet}. */
export type PreviewSheetProps = SheetProps & { link: MusicLink; openLink: () => void };

type Loaded =
	| { state: 'loading' }
	| { state: 'failed' }
	| { state: 'ready'; embed: MusicCollection };

function useCollection(link: MusicLink): Loaded {
	const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

	useEffect(() => {
		let active = true;

		loadCollection(link)
			.then(
				(embed) =>
					active && setLoaded(embed ? { state: 'ready', embed } : { state: 'failed' }),
			)
			.catch((error: unknown) => {
				logger.error(`Failed to load music previews ${link.id}:`, error);

				if (active) setLoaded({ state: 'failed' });
			});

		return () => {
			active = false;
		};
	}, [link.id]);

	return loaded;
}

function TrackRow({
	track,
	playing,
	onToggle,
}: {
	track: PreviewTrack;
	playing: boolean;
	onToggle: () => void;
}) {
	const icon = playing ? 'StopIcon' : 'PlayIcon';

	return (
		<Discord.TableRow
			label={track.title}
			subLabel={
				track.preview || track.search
					? track.subtitle
					: `${track.subtitle} · ${messages.NO_PREVIEW}`
			}
			icon={<Discord.TableRow.Icon source={assets.getIdByName(icon)} />}
			accessibilityLabel={playing ? messages.PAUSE : messages.PLAY}
			disabled={!track.preview && !track.search}
			onPress={onToggle}
		/>
	);
}

/**
 * @description A sheet that plays the 30-second previews of a Spotify or Apple Music song, album or playlist.
 * @param props The music link, what opens it as Discord would and what closes the sheet.
 * @returns The sheet.
 */
function PreviewSheet({ link, openLink, onClose }: PreviewSheetProps) {
	const styles = useStyles();
	const { ActionSheet } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const loaded = useCollection(link);
	const [playing, setPlaying] = useState<string>();

	useEffect(() => stopPreview, []);

	const [found, setFound] = useState<Record<string, string | null>>({});

	const clipOf = (track: PreviewTrack) =>
		track.preview ?? (track.search ? (found[track.search] ?? undefined) : undefined);

	async function resolveClip(track: PreviewTrack): Promise<string | undefined> {
		if (track.preview || !track.search) return track.preview;
		if (track.search in found) return found[track.search] ?? undefined;

		const clip = await searchPreview(track.search);

		setFound((now) => ({ ...now, [track.search!]: clip ?? null }));

		return clip;
	}

	async function play(track: PreviewTrack, key: string) {
		const clip = await resolveClip(track);

		if (!clip) {
			setPlaying((now) => (now === key ? undefined : now));

			return;
		}

		await playPreview(clip, () => setPlaying((now) => (now === key ? undefined : now)));
	}

	function toggle(track: PreviewTrack, key: string) {
		if (playing === key) {
			stopPreview();
			setPlaying(undefined);

			return;
		}

		setPlaying(key);
		play(track, key).catch((error: unknown) => {
			logger.error(`Failed to play music preview ${link.id}:`, error);
			setPlaying(undefined);
		});
	}

	return (
		<ActionSheet scrollable>
			<ScrollView contentContainerStyle={styles.body}>
				{loaded.state === 'ready' ? (
					<>
						<View style={styles.header}>
							{loaded.embed.cover ? (
								<Image source={{ uri: loaded.embed.cover }} style={styles.cover} />
							) : null}
							<View style={styles.titles}>
								<Discord.Text variant='heading-lg/bold' numberOfLines={2}>
									{loaded.embed.title}
								</Discord.Text>
								<Discord.Text
									variant='text-sm/medium'
									color='text-muted'
									numberOfLines={1}
								>
									{loaded.embed.subtitle}
								</Discord.Text>
							</View>
						</View>
						<Discord.TableRowGroup hasIcons>
							{loaded.embed.tracks.map((track, index) => {
								const key = `${index}:${track.title}`;
								const searched =
									track.search !== undefined && found[track.search] === null;

								return (
									<TrackRow
										key={key}
										track={
											searched
												? { ...track, search: undefined }
												: { ...track, preview: clipOf(track) }
										}
										playing={playing === key}
										onToggle={() => toggle(track, key)}
									/>
								);
							})}
						</Discord.TableRowGroup>
					</>
				) : (
					<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.status}>
						{loaded.state === 'loading' ? messages.LOADING : messages.LOAD_FAILED}
					</Discord.Text>
				)}
				<Discord.Button
					variant='secondary'
					text={
						link.service === 'apple'
							? messages.OPEN_IN_APPLE_MUSIC
							: messages.OPEN_IN_SPOTIFY
					}
					onPress={() => {
						onClose();
						openLink();
					}}
				/>
			</ScrollView>
		</ActionSheet>
	);
}

export default PreviewSheet;
