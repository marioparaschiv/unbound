import type { AddonPage } from '@unbound-app/contracts/addon-page';
import { ScrollView } from 'react-native';
import { useMemo } from 'react';

import { findPageMedia, type StorePage } from '~/marketplace/store-page';

import type { ScreenRect } from './screen-rect-context';

import { openPageMedia, type ViewerEntry } from './open-page-media';
import GalleryThumbnail from './gallery-thumbnail';
import useStyles from './page-gallery.style';

type PageGalleryProps = {
	page: StorePage;
	entries: AddonPage['frontmatter']['media'];
};

type GalleryEntry = ViewerEntry & { alt: string };

// Only files the page measured are shown, so an entry the server never checked is left out.
function resolveEntries(page: StorePage, entries: PageGalleryProps['entries']): GalleryEntry[] {
	return entries.flatMap((entry) => {
		const media = findPageMedia(page, 'image' in entry ? entry.image : entry.video);
		const poster =
			'video' in entry && entry.poster ? findPageMedia(page, entry.poster) : undefined;

		return media ? [{ media, poster, alt: entry.alt }] : [];
	});
}

/**
 * @description The frontmatter's `media` as a row that scrolls sideways, each entry at one height and its
 * own aspect ratio, in the order ADDON.md lists them. Tapping one opens the viewer out of it, paging
 * through the whole gallery.
 */
function PageGallery({ page, entries }: PageGalleryProps) {
	const styles = useStyles();
	const resolved = useMemo(() => resolveEntries(page, entries), [page, entries]);

	function open(index: number, origin: ScreenRect | undefined) {
		openPageMedia(resolved, index, origin);
	}

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
		>
			{resolved.map((entry, index) => (
				<GalleryThumbnail
					key={`${index}:${entry.media.path}`}
					entry={entry}
					alt={entry.alt}
					onPress={(origin) => open(index, origin)}
				/>
			))}
		</ScrollView>
	);
}

export default PageGallery;
