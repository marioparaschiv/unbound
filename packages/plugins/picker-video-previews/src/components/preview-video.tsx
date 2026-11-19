import { useEffect, useState, type ReactElement } from 'react';

import type { VideoComponent } from '~/lib/play-preview';

export type PreviewVideoProps = {
	findFile: (uri: string) => Promise<string | undefined>;
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

	useEffect(() => {
		let current = true;

		findFile(uri)
			.then((found) => current && setFile(found))
			.catch((error: unknown) =>
				logger.error(`Failed to find the file of video ${uri}:`, error),
			);

		return () => {
			current = false;
		};
	}, [findFile, uri]);

	if (!file) return thumbnail;

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
