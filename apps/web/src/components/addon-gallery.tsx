import { useEffect, useRef, useState } from 'react';

import GalleryThumbnail from '~/components/gallery-thumbnail';
import GalleryLightbox from '~/components/gallery-lightbox';
import useScrollShadow from '~/hooks/use-scroll-shadow';
import type { ResolvedMedia } from '~/lib/page-media';
import useDragScroll from '~/hooks/use-drag-scroll';
import { morph } from '~/lib/view-transition';

export type GalleryEntry = {
	media: ResolvedMedia;
	alt: string;
	poster: string | undefined;
};

type AddonGalleryProps = {
	entries: GalleryEntry[];
};

// One name at a time: only the entry opening or closing holds it.
const MORPH_NAME = 'gallery-media';

// Matches `--fade-size` in `styles/gallery.css`.
const FADE_SIZE = 64;

// Whether a thumbnail sits under either edge fade, where the mask would cut into it as it lands.
function isUnderFade(thumbnail: HTMLElement, row: HTMLElement): boolean {
	const inner = row.getBoundingClientRect();
	const rect = thumbnail.getBoundingClientRect();

	return rect.left < inner.left + FADE_SIZE || rect.right > inner.right - FADE_SIZE;
}

/**
 * @description Shows a store page's gallery as one row that pans sideways, by touch, trackpad or a mouse
 * drag, its edges fading while there is more past them. An entry opens in a lightbox that grows
 * out of its thumbnail, and closing shrinks it back into the thumbnail of the entry last shown.
 * @param props The gallery's resolved entries, in frontmatter order.
 * @returns The gallery list and its lightbox.
 */
function AddonGallery({ entries }: AddonGalleryProps) {
	const [active, setActive] = useState<number>();
	const thumbnails = useRef<(HTMLButtonElement | null)[]>([]);
	const frame = useRef<HTMLDivElement>(null);
	const closed = useRef<number>(undefined);
	const { ref, canScrollStart, canScrollEnd, onScroll } = useScrollShadow('x');
	const dragScroll = useDragScroll();

	// Stepping through the lightbox keeps the entry's thumbnail in view, so closing lands on it.
	useEffect(() => {
		if (active !== undefined) {
			thumbnails.current[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}, [active]);

	function open(index: number) {
		morph({
			name: MORPH_NAME,
			from: thumbnails.current[index],
			to: () => frame.current,
			update: () => setActive(index),
		});
	}

	// The entry slides out the way the user stepped while the next one slides in after it, both blurred.
	function step(index: number, direction: 'next' | 'previous') {
		void morph({
			name: MORPH_NAME,
			from: frame.current,
			to: () => frame.current,
			update: () => setActive(index),
			kind: `gallery-${direction}`,
		});
	}

	// The lightbox snapshot lands unmasked, so a fade over its thumbnail drops away for the landing and
	// eases back in once it has settled, instead of cutting into the image as the morph ends.
	function close() {
		const row = ref.current;
		const thumbnail = active === undefined ? undefined : thumbnails.current[active];
		const settling = Boolean(row && thumbnail && isUnderFade(thumbnail, row));

		closed.current = active;
		void morph({
			name: MORPH_NAME,
			from: frame.current,
			to: () => thumbnail,
			update: () => {
				if (settling && row) {
					row.dataset.settling = '';
				}

				setActive(undefined);
			},
			passThrough: true,
		}).then(() => {
			delete row?.dataset.settling;
		});
	}

	function onCloseAutoFocus(event: Event) {
		event.preventDefault();
		thumbnails.current[closed.current ?? 0]?.focus({ preventScroll: true });
	}

	return (
		<>
			<div
				ref={ref}
				onScroll={onScroll}
				{...dragScroll}
				data-fade-start={canScrollStart ? '' : undefined}
				data-fade-end={canScrollEnd ? '' : undefined}
				className='relative overflow-x-auto overflow-y-hidden overscroll-x-contain hide-scrollbar scroll-fade-x cursor-grab data-dragging:cursor-grabbing select-none [-webkit-touch-callout:none]'
			>
				<ul
					aria-label='Gallery'
					className='flex [--gap:--spacing(3)] gap-(--gap) drag-scroll-room'
				>
					{entries.map((entry, index) => (
						<li
							key={`${index}:${entry.media.path}`}
							className='h-48 sm:h-64 max-w-[85%] shrink-0'
						>
							<GalleryThumbnail
								ref={(element) => {
									thumbnails.current[index] = element;
								}}
								entry={entry}
								active={index === active}
								onOpen={() => open(index)}
							/>
						</li>
					))}
				</ul>
			</div>
			<GalleryLightbox
				entries={entries}
				index={active}
				frameRef={frame}
				onStep={step}
				onClose={close}
				onCloseAutoFocus={onCloseAutoFocus}
			/>
		</>
	);
}

export default AddonGallery;
