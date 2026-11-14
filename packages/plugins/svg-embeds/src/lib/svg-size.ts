/** An SVG's intrinsic size, in CSS pixels. */
export type SvgSize = { width: number; height: number };

const DEFAULT_SIZE: SvgSize = { width: 300, height: 150 };
const ROOT = /<svg\b[^>]*>/i;

function attribute(tag: string, name: string): string | undefined {
	return new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
}

function pixels(value: string | undefined): number | undefined {
	const match = value ? /^\s*([\d.]+)\s*(px)?\s*$/i.exec(value) : null;
	const number = match ? Number(match[1]) : NaN;

	return Number.isFinite(number) && number > 0 ? number : undefined;
}

/**
 * @description Reads an SVG's size from its root element: `width` and `height` in pixels, else its `viewBox`, else the
 * browser default of 300 by 150.
 * @param markup The SVG file.
 * @returns The size.
 */
export function svgSize(markup: string): SvgSize {
	const tag = ROOT.exec(markup)?.[0];

	if (!tag) return DEFAULT_SIZE;

	const box = attribute(tag, 'viewBox')
		?.trim()
		.split(/[\s,]+/)
		.map(Number);
	const boxWidth = box?.length === 4 && box[2]! > 0 ? box[2] : undefined;
	const boxHeight = box?.length === 4 && box[3]! > 0 ? box[3] : undefined;
	const width = pixels(attribute(tag, 'width'));
	const height = pixels(attribute(tag, 'height'));

	if (width && height) return { width, height };

	if (width && boxWidth && boxHeight) return { width, height: (width * boxHeight) / boxWidth };

	if (height && boxWidth && boxHeight) return { width: (height * boxWidth) / boxHeight, height };

	if (boxWidth && boxHeight) return { width: boxWidth, height: boxHeight };

	return DEFAULT_SIZE;
}

export default svgSize;
