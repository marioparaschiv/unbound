import { Image, Pressable, type StyleProp, type View, type ViewStyle } from 'react-native';
import { useContext, useRef } from 'react';

import type { PageMediaFile } from '~/marketplace/store-page';
import { Video } from '~/metro/components';

import ScreenRectContext from './screen-rect-context';
import { openPageMedia } from './open-page-media';
import useStyles from './page-media.style';

type PageMediaProps = {
	media: PageMediaFile;
	alt: string;
	/** The image a video shows before it plays. */
	poster?: PageMediaFile;
	/** Sizes the frame; without a width or height it fills the row at the media's aspect ratio. */
	style?: StyleProp<ViewStyle>;
};

/**
 * @description One image or video of a store page at its measured aspect ratio. Tapping an image opens
 * Discord's media viewer out of it; a video plays in place with the player's own controls.
 */
function PageMedia({ media, alt, poster, style }: PageMediaProps) {
	const styles = useStyles();
	const ref = useRef<View>(null);
	const measureOnScreen = useContext(ScreenRectContext);
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
			ref={ref}
			onPress={() =>
				measureOnScreen(ref.current, (origin) => openPageMedia([{ media }], 0, origin))
			}
		>
			<Image source={{ uri: media.url }} style={styles.fill} resizeMode='cover' />
		</Pressable>
	);
}

export default PageMedia;
