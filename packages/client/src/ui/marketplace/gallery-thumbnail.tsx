import { Image, Pressable, View } from 'react-native';
import { useContext, useRef } from 'react';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { Video } from '~/metro/components';
import { icons } from '~/assets/api';

import type { ScreenRect } from './screen-rect-context';
import type { ViewerEntry } from './open-page-media';

import useStyles, { GALLERY_HEIGHT } from './page-gallery.style';
import ScreenRectContext from './screen-rect-context';

type GalleryThumbnailProps = {
	entry: ViewerEntry;
	alt: string;
	/** Opens the entry, growing out of the thumbnail's frame on the screen. */
	onPress: (origin: ScreenRect | undefined) => void;
};

/**
 * @description One gallery entry at the row's height and its own aspect ratio. A video shows its poster,
 * or its first frame without one, under a play badge.
 */
function GalleryThumbnail({ entry, alt, onPress }: GalleryThumbnailProps) {
	const styles = useStyles();
	const ref = useRef<View>(null);
	const measureOnScreen = useContext(ScreenRectContext);
	const { media, poster } = entry;
	const isVideo = media.kind === 'video';

	return (
		<Pressable
			ref={ref}
			style={[styles.thumbnail, { width: (GALLERY_HEIGHT * media.width) / media.height }]}
			accessibilityRole='imagebutton'
			accessibilityLabel={alt}
			onPress={() => measureOnScreen(ref.current, onPress)}
		>
			{isVideo && !poster ? (
				<Video.VideoComponent
					style={styles.fill}
					source={{ uri: media.url }}
					resizeMode='cover'
					pointerEvents='none'
					paused
					muted
				/>
			) : (
				<Image
					source={{ uri: (poster ?? media).url }}
					style={styles.fill}
					resizeMode='cover'
				/>
			)}
			{isVideo ? (
				<View style={styles.badgeFrame} pointerEvents='none'>
					<View style={styles.badge}>
						<TintedIcon
							source={icons.PlayIcon ?? 0}
							size={20}
							style={styles.badgeIcon}
						/>
					</View>
				</View>
			) : null}
		</Pressable>
	);
}

export default GalleryThumbnail;
