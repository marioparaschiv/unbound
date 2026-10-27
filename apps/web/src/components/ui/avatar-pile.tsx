import type { ComponentProps, CSSProperties } from 'react';
import { Children, isValidElement } from 'react';

import cn from '~/lib/cn';

type AvatarPileProps = ComponentProps<'span'> & {
	/** Diameter of each avatar in pixels. */
	size: number;
	/** How many people the pile stands for. Those not passed as children show as a "+N" chip. */
	totalCount?: number;
};

// Matches Discord's AvatarPile: each avatar slides 40% under the one before it.
const DEPTH_X = 0.4;

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

/**
 * @description Builds the mask that cuts the next avatar's outline, plus a gap ring, out of an avatar.
 * @param size The avatar diameter in pixels.
 * @param gap The width of the ring between two avatars in pixels.
 * @returns The CSS mask image.
 */
function cutout(size: number, gap: number): string {
	const radius = size / 2 + gap;
	const centerX = size * (1 - DEPTH_X) + gap + size / 2;

	return `radial-gradient(circle at ${centerX}px 50%, transparent ${radius}px, #000 ${radius + 0.5}px)`;
}

/**
 * @description Picks the "+N" chip's font size for an avatar size, after Discord's PileOverflow.
 * @param size The avatar diameter in pixels.
 * @returns The font size in pixels.
 */
function overflowFontSize(size: number): number {
	if (size >= 64) {
		return 18;
	}

	if (size >= 40) {
		return 16;
	}

	if (size >= 30) {
		return 14;
	}

	if (size >= 24) {
		return 12;
	}

	return 10;
}

/** Overlapping avatars, each cut out where the next one sits, ending in a "+N" chip for the rest. */
function AvatarPile({ size, totalCount, children, className, ...props }: AvatarPileProps) {
	const items = Children.toArray(children).filter(isValidElement);
	const overflow = totalCount === undefined ? 0 : totalCount - items.length;
	const gap = size <= 40 ? 2 : 3;
	const mask = cutout(size, gap);
	const overlap = gap - size * DEPTH_X;
	const lastMasked = overflow > 0 ? items.length : items.length - 1;

	function slotStyle(index: number): CSSProperties {
		return {
			width: size,
			height: size,
			marginLeft: index > 0 ? overlap : 0,
			maskImage: index < lastMasked ? mask : undefined,
		};
	}

	return (
		<span className={cn('inline-flex shrink-0 items-center', className)} {...props}>
			{items.map((item, index) => (
				<span key={item.key ?? index} className='flex shrink-0' style={slotStyle(index)}>
					{item}
				</span>
			))}
			{overflow > 0 ? (
				<span
					className='box-border flex shrink-0 items-center justify-center bg-muted font-semibold text-foreground leading-none tabular-nums [text-box:trim-both_cap_alphabetic]'
					style={{
						height: size,
						minWidth: size,
						borderRadius: size / 2,
						paddingInline: size >= 32 ? 8 : 4,
						marginLeft: items.length > 0 ? overlap : 0,
						fontSize: overflowFontSize(size),
					}}
				>
					+{compact.format(overflow)}
				</span>
			) : null}
		</span>
	);
}

export type { AvatarPileProps };

export default AvatarPile;
