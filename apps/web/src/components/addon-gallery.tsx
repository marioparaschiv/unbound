import type { ResolvedMedia } from '~/lib/page-media';
import MediaFile from '~/components/media-file';

export type GalleryEntry = {
	media: ResolvedMedia;
	alt: string;
	poster: string | undefined;
};

type AddonGalleryProps = {
	entries: GalleryEntry[];
};

/**
 * @description Shows a store page's gallery as one scrolling row.
 * @param props The gallery's resolved entries, in frontmatter order.
 * @returns The gallery list.
 */
function AddonGallery({ entries }: AddonGalleryProps) {
	return (
		<ul aria-label='Gallery' className='flex gap-3 pb-2 overflow-x-auto snap-x snap-mandatory'>
			{entries.map((entry, index) => (
				<li
					key={`${index}:${entry.media.path}`}
					className='h-48 sm:h-64 shrink-0 snap-start'
				>
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

export default AddonGallery;
