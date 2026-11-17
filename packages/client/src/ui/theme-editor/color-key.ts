const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const RGB = /^rgba?\(([^)]+)\)$/;

function byte(value: number): string {
	return Math.round(Math.min(Math.max(value, 0), 255))
		.toString(16)
		.padStart(2, '0');
}

function fromArgb(argb: number): string {
	const value = argb >>> 0;

	return `#${byte((value >>> 16) & 0xff)}${byte((value >>> 8) & 0xff)}${byte(value & 0xff)}${byte(value >>> 24)}`;
}

function fromHex(digits: string): string {
	const full = digits.length <= 4 ? digits.replaceAll(/./g, '$&$&') : digits;

	return `#${full.length === 6 ? `${full}ff` : full}`;
}

function fromRgb(args: string): string | undefined {
	const parts = args.split(/[\s,/]+/).filter(Boolean);

	if (parts.length < 3 || parts.length > 4) return;

	const [red, green, blue] = parts.slice(0, 3).map(Number);
	const alpha = parts[3]?.endsWith('%')
		? Number.parseFloat(parts[3]) / 100
		: Number(parts[3] ?? 1);

	if ([red, green, blue, alpha].some(Number.isNaN)) return;

	return `#${byte(red)}${byte(green)}${byte(blue)}${byte(alpha * 255)}`;
}

function parse(value: string): string | undefined {
	const color = value.trim().toLowerCase();
	const hex = HEX.exec(color);

	if (hex) {
		return fromHex(hex[1]);
	}

	const rgb = RGB.exec(color);

	return rgb ? fromRgb(rgb[1]) : undefined;
}

/**
 * @description Turns a colour from a style or native prop into one comparable key.
 * @param value A colour string (`#rgb`, `#rrggbbaa`, `rgba(...)`), an ARGB number, or `react-native-svg`'s `{ payload }`.
 * @returns Lowercase `#rrggbbaa`, or `undefined` for a non-colour or a fully transparent one.
 */
// UNKNOWN: styles and native props hold colours in several forms, or none.
export function colorKey(value: unknown): string | undefined {
	let key: string | undefined;

	if (typeof value === 'number') {
		key = fromArgb(value);
	} else if (typeof value === 'string') {
		key = parse(value);
	} else if (value && typeof value === 'object' && 'payload' in value) {
		key = typeof value.payload === 'number' ? fromArgb(value.payload) : undefined;
	}

	return key?.endsWith('00') ? undefined : key;
}
