import { IconChevronLeft, IconChevronRight, IconXmark } from 'nucleo-micro-bold';
import type { CSSProperties, KeyboardEvent, MouseEvent, Ref } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import type { GalleryEntry } from '~/components/addon-gallery';
import MediaFile from '~/components/media-file';

type GalleryLightboxProps = {
	entries: GalleryEntry[];
	/** The entry shown, or `undefined` while the lightbox is closed. */
	index: number | undefined;
	/** The frame around the shown entry, which the thumbnail morphs into. */
	frameRef: Ref<HTMLDivElement>;
	/** Shows another entry; `direction` is the way the user stepped, for the slide between them. */
	onStep: (index: number, direction: 'next' | 'previous') => void;
	onClose: () => void;
	/** Runs instead of Radix returning focus to whatever opened the lightbox. */
	onCloseAutoFocus: (event: Event) => void;
};

const CONTROL =
	'flex justify-center items-center bg-white/10 hover:bg-white/20 rounded-full size-10 text-white transition-colors press-flat outline-none focus-visible:ring-[3px] focus-visible:ring-halo';

// The largest box at the entry's aspect ratio that fits the viewport above the caption, never past its own size.
function frameStyle({ media }: GalleryEntry): CSSProperties {
	return {
		width: `min(100%, ${media.width}px, calc((100dvh - 9rem) * ${media.width / media.height}))`,
	};
}

/**
 * @description Shows one gallery entry over the page at its largest fitting size, with arrows, the arrow
 * keys and its caption. Escape, the close button or a click beside the media closes it.
 * @param props The entries, the one shown, its frame's ref and the open, step and close handlers.
 * @returns The lightbox dialog.
 */
function GalleryLightbox({
	entries,
	index,
	frameRef,
	onStep,
	onClose,
	onCloseAutoFocus,
}: GalleryLightboxProps) {
	const entry = index === undefined ? undefined : entries[index];
	const count = entries.length;

	function step(delta: number) {
		if (index !== undefined) {
			onStep((index + delta + count) % count, delta > 0 ? 'next' : 'previous');
		}
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			step(-1);
		}

		if (event.key === 'ArrowRight') {
			step(1);
		}
	}

	function onBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	return (
		<DialogPrimitive.Root open={entry !== undefined} onOpenChange={(open) => open || onClose()}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className='z-50 fixed inset-0 bg-black/85 backdrop-blur-md' />
				<DialogPrimitive.Content
					aria-describedby={undefined}
					onKeyDown={onKeyDown}
					onCloseAutoFocus={onCloseAutoFocus}
					onClick={onBackdropClick}
					className='z-50 fixed inset-0 flex flex-col justify-center items-center gap-4 p-4 sm:p-8 outline-none'
				>
					<DialogPrimitive.Title className='sr-only'>{entry?.alt}</DialogPrimitive.Title>
					{entry ? (
						<div ref={frameRef} className='rounded-control' style={frameStyle(entry)}>
							<MediaFile
								key={index}
								media={entry.media}
								alt={entry.alt}
								poster={entry.poster}
								autoPlay
								className='w-full h-auto'
							/>
						</div>
					) : null}
					<div className='flex items-center gap-3 w-full max-w-xl [view-transition-name:gallery-controls]'>
						{count > 1 ? (
							<button type='button' className={CONTROL} onClick={() => step(-1)}>
								<IconChevronLeft size={18} />
								<span className='sr-only'>Previous</span>
							</button>
						) : null}
						<p className='flex-1 text-white/80 text-sm text-center truncate'>
							{entry?.alt}
							{count > 1 ? (
								<span className='ml-2 text-white/50 tabular-nums'>
									{(index ?? 0) + 1} / {count}
								</span>
							) : null}
						</p>
						{count > 1 ? (
							<button type='button' className={CONTROL} onClick={() => step(1)}>
								<IconChevronRight size={18} />
								<span className='sr-only'>Next</span>
							</button>
						) : null}
					</div>
					<DialogPrimitive.Close className={`absolute top-4 right-4 ${CONTROL}`}>
						<IconXmark size={18} />
						<span className='sr-only'>Close</span>
					</DialogPrimitive.Close>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

export default GalleryLightbox;
