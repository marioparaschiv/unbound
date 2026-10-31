import atlasUrl, { columns, names, pitch } from 'virtual:addon-icon-atlas';
import type { CSSProperties } from 'react';

import cn from '~/lib/cn';

type AtlasIconProps = {
	name: string;
	/** The drawn size in px; the atlas is scaled to match. */
	size?: number;
	className?: string;
};

const INDEX = new Map(names.map((name, index) => [name, index]));

const ROWS = Math.ceil(names.length / columns);

let warmed: Promise<void> | undefined;

/**
 * @description Downloads and parses the atlas ahead of the picker, once per page, so it opens on a ready image.
 * @returns Resolves once the atlas is decoded, or failed to load.
 */
export function warmAddonIconAtlas(): Promise<void> {
	if (!warmed) {
		const image = new Image();

		image.src = atlasUrl;
		warmed = image.decode().catch(() => {
			warmed = undefined;
		});
	}

	return warmed;
}

/**
 * @description Masks the icon's cell out of the shared atlas, in the current text colour.
 * @param name The icon name.
 * @param size The drawn size in px.
 * @returns The element's inline style.
 */
function atlasStyle(name: string, size: number): CSSProperties {
	const index = INDEX.get(name) ?? 0;
	const scale = size / (pitch - 2);
	const x = ((index % columns) * pitch + 1) * scale;
	const y = (Math.floor(index / columns) * pitch + 1) * scale;
	const mask = `url(${atlasUrl}) -${x}px -${y}px / ${columns * pitch * scale}px ${ROWS * pitch * scale}px no-repeat`;

	// The atlas is greyscale coverage, white where an icon is drawn.
	return { width: size, height: size, mask, WebkitMask: mask, maskMode: 'luminance' };
}

// One plain element per icon over a bitmap: an SVG `<use>` per cell clones a tree each, and an SVG
// mask repaints the whole image per cell, which both stall opening.
/** One addon icon drawn from the shared atlas, which the browser fetches once and caches for good. */
function AtlasIcon({ name, size = 20, className }: AtlasIconProps) {
	return (
		<span
			className={cn('inline-block bg-current shrink-0', className)}
			style={atlasStyle(name, size)}
			aria-hidden
		/>
	);
}

export default AtlasIcon;
