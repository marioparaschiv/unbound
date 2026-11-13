import type { ViewProperty, ViewPropertyValue, ViewSection } from '@unbound-app/debugger-protocol';

import { clipText } from '~/debugger/view-node.dev';

/** A section's properties as read, where `undefined` marks one the view did not report. */
export type PropertyDraft = ViewProperty | undefined;

const LAYOUT_SIZES: Record<number, string> = { [-1]: 'match_parent', [-2]: 'wrap_content' };

/**
 * @description Builds a property, clipping long text so one view cannot flood the socket.
 * @param key The property name.
 * @param value Its value.
 * @param unit The unit a number is in.
 * @returns The property.
 */
export function property(key: string, value: ViewPropertyValue, unit?: string): ViewProperty {
	const clipped = typeof value === 'string' ? (clipText(value) ?? '') : value;

	return unit === undefined ? { key, value: clipped } : { key, value: clipped, unit };
}

/**
 * @description Builds a colour property, drawn as a swatch.
 * @param key The property name.
 * @param hex The colour as `#RRGGBBAA`, or `null` when unset.
 * @returns The property.
 */
export function colorProperty(key: string, hex: string | null): ViewProperty {
	return hex ? { key, value: hex, kind: 'color' } : { key, value: null };
}

/**
 * @description Builds a section from the properties a view reported, dropping the rest.
 * @param title The section title.
 * @param drafts The properties, `undefined` where the view had none.
 * @returns The section, or `undefined` when nothing was reported.
 */
export function section(title: string, drafts: PropertyDraft[]): ViewSection | undefined {
	const properties = drafts.filter((draft): draft is ViewProperty => draft !== undefined);

	return properties.length ? { title, properties } : undefined;
}

/**
 * @description Rounds a measurement to a tenth, after scaling pixels to dp when a density is given.
 * @param value The measurement.
 * @param density The display's pixels per dp, or 1 to keep the value's unit.
 * @returns The rounded value.
 */
export function round(value: number, density = 1): number {
	const scale = density > 0 ? density : 1;

	return Math.round((value / scale) * 10) / 10;
}

/**
 * @description Formats an Android ARGB colour int as `#RRGGBBAA`.
 * @param argb The colour, as `Color.toArgb` or `getCurrentTextColor` returns it.
 * @returns The hex colour.
 */
export function argbToHex(argb: number): string {
	const value = argb >>> 0;
	const byte = (shift: number) => ((value >>> shift) & 0xff).toString(16).padStart(2, '0');

	return `#${byte(16)}${byte(8)}${byte(0)}${byte(24)}`.toUpperCase();
}

/**
 * @description Formats colour components from 0 to 1 as `#RRGGBBAA`.
 * @param components Red, green, blue and alpha.
 * @returns The hex colour.
 */
export function componentsToHex([red, green, blue, alpha]: number[]): string {
	const byte = (value = 1) =>
		Math.round(Math.min(Math.max(value, 0), 1) * 255)
			.toString(16)
			.padStart(2, '0');

	return `#${byte(red)}${byte(green)}${byte(blue)}${byte(alpha)}`.toUpperCase();
}

/**
 * @description Reads a `UIColor` description, such as `UIExtendedSRGBColorSpace 1 0 0 1` or `UIExtendedGrayColorSpace 0 1`.
 * @param description The colour's `description`.
 * @returns The hex colour, or `undefined` when the description is not one of the plain colour spaces.
 */
export function uiColorToHex(description: string): string | undefined {
	const match = /^UI\w*?(RGB|Gray)ColorSpace ((?:-?[\d.e-]+ ?)+)$/.exec(description.trim());
	const numbers = match?.[2]?.trim().split(' ').map(Number);

	if (!match || !numbers || numbers.some(Number.isNaN)) {
		return undefined;
	}

	if (match[1] === 'Gray' && numbers.length === 2) {
		const [white = 0, alpha = 1] = numbers;

		return componentsToHex([white, white, white, alpha]);
	}

	return numbers.length === 4 ? componentsToHex(numbers) : undefined;
}

/**
 * @description Names an Android `LayoutParams` width or height.
 * @param size The size in pixels, or `MATCH_PARENT` (-1) or `WRAP_CONTENT` (-2).
 * @param density The display's pixels per dp.
 * @returns The size's name, or the size in dp.
 */
export function layoutSize(size: number, density: number): ViewProperty['value'] {
	return LAYOUT_SIZES[size] ?? round(size, density);
}

/**
 * @description Names an enum value from a table, keeping the number when the table has no name for it.
 * @param names The names by value.
 * @param value The value.
 * @returns Its name, or the value as text.
 */
export function enumName(names: Record<number, string>, value: number): string {
	return names[value] ?? String(value);
}

/**
 * @description Names the bits set in a mask, such as `UIAccessibilityTraits`.
 * @param names The name of each bit, by its value.
 * @param mask The mask.
 * @returns The names joined with `|`, `none` for 0, and unnamed bits in hex.
 */
export function bitNames(names: Record<number, string>, mask: number): string {
	if (mask === 0) {
		return 'none';
	}

	const parts: string[] = [];
	let rest = mask;

	for (const [bit, name] of Object.entries(names)) {
		const value = Number(bit);

		if (mask & value) {
			parts.push(name);
			rest &= ~value;
		}
	}

	if (rest) {
		parts.push(`0x${rest.toString(16)}`);
	}

	return parts.join(' | ');
}

export default {
	bitNames,
	property,
	colorProperty,
	section,
	round,
	argbToHex,
	componentsToHex,
	uiColorToHex,
	layoutSize,
	enumName,
};
