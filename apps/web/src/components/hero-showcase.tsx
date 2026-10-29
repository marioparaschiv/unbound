import type { ComponentProps } from 'react';

import { revealStyle } from '~/components/motion/reveal-style';
import cn from '~/lib/cn';

type HeroShowcaseProps = ComponentProps<'div'> & {
	alt?: string;
	fade?: boolean;
	delay?: number;
};

const GLOW_SRC = '/img/hero-glow.avif';

const HERO_WIDTHS = [768, 1280, 1600, 2048, 2880];

const HERO_SRC = '/img/hero-1600.avif';

const HERO_SRCSET = HERO_WIDTHS.map((width) => `/img/hero-${width}.avif ${width}w`).join(', ');

// How wide the home page draws the showcase: 130vw - 20px below md, the padded page up to 1600px above it.
const HERO_SIZES =
	'(min-width: 1632px) 1600px, (min-width: 768px) calc(100vw - 32px), calc(130vw - 20px)';

/**
 * @description The hero phones over an ambient glow cast in each region's own colour.
 * @param props The wrapper's props, the image's alt text, whether the bottom fades into the page, and the entrance delay in milliseconds.
 * @returns The hero image with its glow.
 */
function HeroShowcase({
	alt = 'Unbound hero',
	fade = false,
	delay = 0,
	className,
	...props
}: HeroShowcaseProps) {
	return (
		<div className={cn('relative', className)} {...props}>
			{/* Only the phones move, so they rise from under the fade, which holds still. */}
			<div className='relative animate-reveal' style={revealStyle('showcase', delay)}>
				{/* A blurred copy of the image averages each region's colour, so every phone glows in its own hue. */}
				{/* The blur is baked in with a quarter-width margin for its spread: a live CSS blur this wide stalls the page as the reveal ends. */}
				<img
					src={GLOW_SRC}
					alt=''
					aria-hidden
					draggable={false}
					className='absolute -top-1/3 -left-1/4 w-[150%] max-w-none opacity-30 pointer-events-none select-none'
				/>
				{/* An underglow in the accent ties the phones to it; a gradient, because drop-shadow on the 2880px image is costly to scroll. */}
				<div
					aria-hidden
					className='absolute inset-x-[8%] top-[20%] -bottom-[10%] bg-[radial-gradient(ellipse_at_center,var(--glow),transparent_70%)] pointer-events-none'
				/>
				{/* High priority makes the server render a preload in the head, so the image is ready when the phones slide in. */}
				<img
					src={HERO_SRC}
					srcSet={HERO_SRCSET}
					sizes={HERO_SIZES}
					alt={alt}
					loading='eager'
					fetchPriority='high'
					className='relative w-full'
				/>
			</div>
			{/* The fade reaches past the image so it also covers the glow that the blur spreads outside it. */}
			{fade ? (
				<div className='z-10 absolute -inset-x-1/4 top-0 -bottom-1/4 pointer-events-none hero-fade' />
			) : null}
		</div>
	);
}

export default HeroShowcase;
