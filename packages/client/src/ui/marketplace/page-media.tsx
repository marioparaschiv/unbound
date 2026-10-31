import type { StyleProp, ViewStyle } from 'react-native';
import { Image, Pressable } from 'react-native';

import type { PageMediaFile } from '~/marketplace/store-page';
import { Media, Video } from '~/metro/components';

import useStyles from './page-media.style';

type PageMediaProps = {
	media: PageMediaFile;
	alt: string;
	/** The image a video shows before it plays. */
	poster?: PageMediaFile;
	/** Sizes the frame; without a width or height it fills the row at the media's aspect ratio. */
	style?: StyleProp<ViewStyle>;
};

function openImage({ url, width, height }: PageMediaFile) {
	Media.openMediaModal({
		initialIndex: 0,
		initialSources: [{ uri: url, sourceURI: url, width, height }],
	});
}

/**
 * @description One image or video of a store page at its measured aspect ratio. Tapping an image opens
 * Discord's media viewer; a video plays in place with the player's own controls.
 */
function PageMedia({ media, alt, poster, style }: PageMediaProps) {
	const styles = useStyles();
	const frame = [styles.frame, { aspectRatio: media.width / media.height }, style];

	if (media.kind === 'video') {
		return (
			<Video.VideoComponent
				style={frame}
				source={{ uri: media.url }}
				poster={poster?.url}
				posterResizeMode='cover'
				resizeMode='contain'
				accessibilityLabel={alt}
				controls
				paused
			/>
		);
	}

	return (
		<Pressable
			style={frame}
			accessibilityRole='imagebutton'
			accessibilityLabel={alt}
			onPress={() => openImage(media)}
		>
			<Image source={{ uri: media.url }} style={styles.fill} resizeMode='cover' />
		</Pressable>
	);
}

export default PageMedia;
