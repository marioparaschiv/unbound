import { IconMediaPlayFilled } from 'nucleo-micro-bold';
import type { Ref } from 'react';

import type { GalleryEntry } from '~/components/addon-gallery';
import MediaFile from '~/components/media-file';
import cn from '~/lib/cn';

type GalleryThumbnailProps = {
	entry: GalleryEntry;
	/** The button the lightbox grows out of and shrinks back into. */
	ref: Ref<HTMLButtonElement>;
	/** Hides the thumbnail while the lightbox shows it, so the entry is never on screen twice. */
	active: boolean;
	onOpen: () => void;
};

/**
 * @description One gallery entry at the row's height and its own aspect ratio, as a button that opens it.
 * A video shows its poster under a play badge.
 * @param props The entry, the button's ref, whether the lightbox shows it and what opening does.
 * @returns The thumbnail button.
 */
function GalleryThumbnail({ entry, ref, active, onOpen }: GalleryThumbnailProps) {
	return (
		<button
			ref={ref}
			type='button'
			onClick={onOpen}
			className={cn(
				'group relative block h-full overflow-hidden rounded-control cursor-[inherit] press-flat outline-none focus-visible:outline-solid focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-halo',
				active && 'opacity-0',
			)}
		>
			<MediaFile
				media={entry.media}
				alt={entry.alt}
				poster={entry.poster}
				controls={false}
				className='w-auto max-w-full h-full object-cover pointer-events-none transition-[filter] duration-200 group-hover:brightness-110'
			/>
			{entry.media.kind === 'video' ? (
				<span className='absolute inset-0 flex justify-center items-center pointer-events-none'>
					<span className='flex justify-center items-center bg-black/60 backdrop-blur-sm rounded-full size-12 text-white'>
						<IconMediaPlayFilled size={20} />
					</span>
				</span>
			) : null}
		</button>
	);
}

export default GalleryThumbnail;
