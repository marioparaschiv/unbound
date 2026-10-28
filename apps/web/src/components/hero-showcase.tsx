import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

type HeroShowcaseProps = ComponentProps<'div'> & {
	alt?: string;
	fade?: boolean;
};

const HERO_SRC = '/img/hero.png';

/**
 * @description The hero phones over an ambient glow cast in each region's own colour.
 * @param props The wrapper's props, the image's alt text, and whether the bottom fades into the page.
 * @returns The hero image with its glow.
 */
function HeroShowcase({
	alt = 'Unbound hero',
	fade = false,
	className,
	...props
}: HeroShowcaseProps) {
	return (
		<div className={cn('relative', className)} {...props}>
			{/* A blurred copy of the image averages each region's colour, so every phone glows in its own hue. */}
			<img
				src={HERO_SRC}
				alt=''
				aria-hidden
				draggable={false}
				className='absolute inset-0 w-full translate-y-[4%] scale-[1.04] opacity-30 blur-[48px] md:blur-[100px] brightness-140 saturate-130 pointer-events-none select-none'
			/>
			{/* An underglow in the accent ties the phones to it; a gradient, because drop-shadow on the 2880px image is costly to scroll. */}
			<div
				aria-hidden
				className='absolute inset-x-[8%] top-[20%] -bottom-[10%] bg-[radial-gradient(ellipse_at_center,var(--glow),transparent_70%)] pointer-events-none'
			/>
			<img src={HERO_SRC} alt={alt} className='relative w-full' />
			{/* The fade reaches past the image so it also covers the glow that the blur spreads outside it. */}
			{fade ? (
				<div className='z-10 absolute -inset-x-1/4 top-0 -bottom-1/4 pointer-events-none hero-fade' />
			) : null}
		</div>
	);
}

export default HeroShowcase;
