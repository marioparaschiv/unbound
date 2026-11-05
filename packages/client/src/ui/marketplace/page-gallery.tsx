import type { AddonPage } from '@unbound-app/contracts/addon-page';
import { ScrollView } from 'react-native';

import { findPageMedia, type StorePage } from '~/marketplace/store-page';

import useStyles, { GALLERY_HEIGHT } from './page-gallery.style';
import PageMedia from './page-media';

type PageGalleryProps = {
	page: StorePage;
	entries: AddonPage['frontmatter']['media'];
};

/**
 * @description The frontmatter's `media` as a row that scrolls sideways, each entry at one height and its
 * own aspect ratio, in the order ADDON.md lists them.
 */
function PageGallery({ page, entries }: PageGalleryProps) {
	const styles = useStyles();

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
		>
			{entries.map((entry) => {
				const path = 'image' in entry ? entry.image : entry.video;
				const media = findPageMedia(page, path);
				const poster =
					'video' in entry && entry.poster
						? findPageMedia(page, entry.poster)
						: undefined;

				return media ? (
					<PageMedia
						key={path}
						media={media}
						alt={entry.alt}
						poster={poster}
						style={[
							styles.media,
							{ width: (GALLERY_HEIGHT * media.width) / media.height },
						]}
					/>
				) : null;
			})}
		</ScrollView>
	);
}

export default PageGallery;
