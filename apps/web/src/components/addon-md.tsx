import {
	addonPageFrontmatterSchema,
	splitFrontmatter,
	type AddonPage,
	type PageMedia,
} from '@unbound-app/contracts/addon-page';
import { useMemo } from 'react';

import AddonGallery, { type GalleryEntry } from '~/components/addon-gallery';
import { resolvePageMedia, type PageMediaMap } from '~/lib/page-media';
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

const FRONTMATTER_KEYS = new Set(Object.keys(addonPageFrontmatterSchema.shape));
const TOP_LEVEL_KEY = /^([^\s#:-][^:]*):(?:\s|$)/;

// A legacy page may open with a `---` rule; only a block of page keys is frontmatter.
function isPageFrontmatter(frontmatter: string): boolean {
	const topLevel = frontmatter
		.split(/\r?\n/)
		.filter((line) => line.trim() !== '' && !/^[\s#-]/.test(line));

	return (
		topLevel.length > 0 &&
		topLevel.every((line) => FRONTMATTER_KEYS.has(TOP_LEVEL_KEY.exec(line)?.[1] ?? ''))
	);
}

function getBody(source: string, page: AddonPage | undefined): string {
	const { frontmatter, body } = splitFrontmatter(source);

	if (frontmatter === undefined) {
		return source;
	}

	return page || isPageFrontmatter(frontmatter) ? body : source;
}

function toGalleryEntry(entry: PageMedia, media: PageMediaMap): GalleryEntry | undefined {
	const resolved = media.get('image' in entry ? entry.image : entry.video);

	if (!resolved) return;

	const poster = 'poster' in entry && entry.poster ? media.get(entry.poster)?.src : undefined;

	return { media: resolved, alt: entry.alt, poster };
}

/**
 * @description Renders an addon's store page: the banner and gallery from its measured frontmatter, then
 * the Markdown body with its measured media in place.
 * @param props The ADDON.md text, its source pin, where its media load from and its measured page.
 * @returns The rendered store page.
 */
function AddonMd({ source, pin, mediaBase, page }: AddonMdProps) {
	const body = useMemo(() => getBody(source, page), [source, page]);
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
			{gallery.length > 0 ? <AddonGallery entries={gallery} /> : null}
			<Markdown source={body} pin={pin} media={media} />
		</div>
	);
}

export type { AddonMdProps };

export default AddonMd;
