import type { AddonPage } from '@unbound-app/contracts/addon-page';
import { ScrollView } from 'react-native';

import { findPageMedia, type StorePage } from '~/marketplace/store-page';

import PageMedia from './page-media';

type PageGalleryProps = {
	page: StorePage;
	entries: AddonPage['frontmatter']['media'];
};

const HEIGHT = 200;

/**
 * @description The frontmatter's `media` as a row that scrolls sideways, each entry at one height and its
 * own aspect ratio, in the order ADDON.md lists them.
 */
function PageGallery({ page, entries }: PageGalleryProps) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
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
						style={{ height: HEIGHT, width: (HEIGHT * media.width) / media.height }}
					/>
				) : null;
			})}
		</ScrollView>
	);
}

export default PageGallery;
