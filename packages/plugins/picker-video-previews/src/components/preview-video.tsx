import { Discord } from '@unbound-app/api/metro/components';
import { format } from '@unbound-app/i18n';
import { useEffect, useState, type ReactElement } from 'react';
import { View } from 'react-native';

import type { VideoComponent } from '~/lib/play-preview';

const DOWNLOAD_STYLE = {
	position: 'absolute',
	left: 8,
	right: 8,
	bottom: 8,
	alignItems: 'center',
	paddingHorizontal: 8,
	paddingVertical: 4,
	borderRadius: 8,
	backgroundColor: 'rgba(0, 0, 0, 0.6)',
} as const;

export type PreviewVideoProps = {
	findFile: (uri: string, onProgress: (fraction: number) => void) => Promise<string | undefined>;
	Video: VideoComponent;
	uri: string;
	style?: unknown;
	sound: boolean;
	thumbnail: ReactElement;
};

/**
 * @description Shows a media picker video's thumbnail until its file is found, then plays the file on a loop.
 * @param props The video, its thumbnail and how it plays.
 * @returns The thumbnail or the player.
 */
export function PreviewVideo({ findFile, Video, uri, style, sound, thumbnail }: PreviewVideoProps) {
	const [file, setFile] = useState<string>();
	const [progress, setProgress] = useState<number>();

	useEffect(() => {
		let current = true;

		findFile(uri, (fraction) => current && setProgress(fraction))
			.then((found) => current && setFile(found))
			.catch((error: unknown) =>
				logger.error(`Failed to find the file of video ${uri}:`, error),
			);

		return () => {
			current = false;
		};
	}, [findFile, uri]);

	if (!file) {
		return (
			<View>
				{thumbnail}
				{progress === undefined ? null : (
					<View style={DOWNLOAD_STYLE}>
						<Discord.Text variant='text-sm/semibold' color='white'>
							{format('DOWNLOADING', { percent: Math.round(progress * 100) })}
						</Discord.Text>
					</View>
				)}
			</View>
		);
	}

	return (
		<Video
			style={style}
			source={{ uri: file }}
			paused={false}
			repeat
			muted={!sound}
			preventsDisplaySleepDuringVideoPlayback={false}
		/>
	);
}

export default PreviewVideo;
