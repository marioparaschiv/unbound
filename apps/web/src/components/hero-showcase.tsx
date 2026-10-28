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
				className='absolute inset-0 w-full translate-y-[4%] scale-[1.04] opacity-60 blur-[32px] md:blur-[72px] brightness-250 saturate-300 pointer-events-none select-none'
			/>
			<img src={HERO_SRC} alt={alt} className='relative w-full' />
			{/* The fade reaches past the image so it also covers the glow that the blur spreads outside it. */}
			{fade ? (
				<div className='z-10 absolute -inset-x-1/4 top-0 -bottom-1/4 bg-[linear-gradient(to_bottom,transparent_0%,var(--color-background)_44%)] pointer-events-none' />
			) : null}
		</div>
	);
}

export default HeroShowcase;
