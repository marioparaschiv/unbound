import { BubbleLimits, BubbleStyle } from '~/constants';

export type BubbleColor = {
	red: number;
	green: number;
	blue: number;
	alpha: number;
};

export type BubbleAppearance = {
	radius: number;
	horizontalPadding: number;
	verticalPadding: number;
	color: BubbleColor;
};

export type SettingReader = (key: string) => unknown;

function bounded(value: unknown, fallback: number, maximum: number): number {
	const number = typeof value === 'number' ? value : Number(value);

	if (value === null || value === undefined || value === '' || !Number.isFinite(number)) {
		return fallback;
	}

	return Math.max(0, Math.min(maximum, Math.round(number)));
}

/**
 * @description Reads a `#rgb` or `#rrggbb` color.
 * @param value The stored setting.
 * @returns The color's channels from 0 to 1, or `undefined` when it is not a hex color.
 */
export function parseHexColor(value: unknown): Omit<BubbleColor, 'alpha'> | undefined {
	if (typeof value !== 'string') return;

	const digits = value.trim().replace(/^#/, '');
	const expanded =
		digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;

	if (!/^[\da-f]{6}$/i.test(expanded)) return;

	const [red, green, blue] = [0, 2, 4].map(
		(index) => Number.parseInt(expanded.slice(index, index + 2), 16) / 255,
	);

	return { red: red!, green: green!, blue: blue! };
}

/**
 * @description Builds the bubble's look from the plugin's settings.
 * @param read Reads one setting.
 * @param light Whether Discord shows its light theme, which picks the default color.
 * @returns The radius, padding and color to draw bubbles with.
 */
export function bubbleAppearance(read: SettingReader, light: boolean): BubbleAppearance {
	const base = parseHexColor(read('color')) ?? (light ? BubbleStyle.light : BubbleStyle.dark);
	const opacity = bounded(read('opacity'), BubbleStyle.opacity, BubbleLimits.opacity);

	return {
		radius: bounded(read('radius'), BubbleStyle.radius, BubbleLimits.radius),
		horizontalPadding: bounded(
			read('horizontalPadding'),
			BubbleStyle.horizontalPadding,
			BubbleLimits.padding,
		),
		verticalPadding: bounded(
			read('verticalPadding'),
			BubbleStyle.verticalPadding,
			BubbleLimits.padding,
		),
		color: { ...base, alpha: opacity / 100 },
	};
}

/**
 * @description Packs a bubble color into an Android ARGB integer.
 * @param color The color.
 * @returns The signed 32-bit ARGB value.
 */
export function argb({ red, green, blue, alpha }: BubbleColor): number {
	const channel = (value: number) => Math.round(value * 255);

	return (
		(channel(alpha) << 24) | (channel(red) << 16) | (channel(green) << 8) | channel(blue) | 0
	);
}

export default { argb, bubbleAppearance, parseHexColor };
