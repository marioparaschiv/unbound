import type { AddonPage, PageMedia } from '@unbound-app/contracts/addon-page';
import { splitFrontmatter } from '@unbound-app/contracts/addon-page';
import { useMemo } from 'react';

import { resolvePageMedia, type PageMediaMap, type ResolvedMedia } from '~/lib/page-media';
import type { MarkdownPin } from '~/lib/markdown-url';
import MediaFile from '~/components/media-file';
import Markdown from '~/components/markdown';

type AddonMdProps = {
	/** The ADDON.md text, frontmatter included. */
	source: string;
	pin: MarkdownPin;
	/** The directory URL the addon's `media/` folder sits in: the pinned commit before publish, the CDN version folder after. */
	mediaBase: string;
	/** The page as `ubd build` measured it; without it there is no banner or gallery, and media show as links. */
	page?: AddonPage;
};

type GalleryEntry = {
	media: ResolvedMedia;
	alt: string;
	poster: string | undefined;
};

type GalleryProps = {
	entries: GalleryEntry[];
};

function toGalleryEntry(entry: PageMedia, media: PageMediaMap): GalleryEntry | undefined {
	const resolved = media.get('image' in entry ? entry.image : entry.video);

	if (!resolved) return;

	const poster = 'poster' in entry && entry.poster ? media.get(entry.poster)?.src : undefined;

	return { media: resolved, alt: entry.alt, poster };
}

// A fixed row height and each entry's measured aspect ratio size every box before anything loads.
function Gallery({ entries }: GalleryProps) {
	return (
		<ul aria-label='Gallery' className='flex gap-3 pb-2 overflow-x-auto snap-x snap-mandatory'>
			{entries.map((entry) => (
				<li key={entry.media.path} className='h-48 sm:h-64 shrink-0 snap-start'>
					<MediaFile
						media={entry.media}
						alt={entry.alt}
						poster={entry.poster}
						className='w-auto h-full object-cover'
					/>
				</li>
			))}
		</ul>
	);
}

/**
 * @description Renders an addon's store page: the banner and gallery from its measured frontmatter, then
 * the Markdown body with its measured media in place.
 * @param props The ADDON.md text, its source pin, where its media load from and its measured page.
 * @returns The rendered store page.
 */
function AddonMd({ source, pin, mediaBase, page }: AddonMdProps) {
	const body = useMemo(() => splitFrontmatter(source).body, [source]);
	const media = useMemo(
		() => (page ? resolvePageMedia(page, mediaBase) : undefined),
		[page, mediaBase],
	);

	if (!page || !media) {
		return <Markdown source={body} pin={pin} />;
	}

	const banner = media.get(page.frontmatter.banner);
	const gallery = page.frontmatter.media
		.map((entry) => toGalleryEntry(entry, media))
		.filter((entry) => entry !== undefined);

	return (
		<div className='flex flex-col gap-6 min-w-0'>
			{banner ? (
				<MediaFile media={banner} alt='' className='w-full h-auto object-cover' />
			) : null}
			{gallery.length > 0 ? <Gallery entries={gallery} /> : null}
			<Markdown source={body} pin={pin} media={media} />
		</div>
	);
}

export type { AddonMdProps };

export default AddonMd;
