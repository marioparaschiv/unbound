import { colorKey } from './color-key';

/** The props of a drawn element that can hold a colour. */
export type HostProps = {
	// UNKNOWN: a style nests arrays, objects and falsy values to any depth.
	style?: unknown;
	// UNKNOWN: native colour props are strings, ARGB numbers or `react-native-svg` objects.
	tintColor?: unknown;
	// UNKNOWN: as `tintColor`.
	fill?: unknown;
};

/** What a colour paints on an element. */
export type ColorRole = 'text' | 'icon' | 'border' | 'background';

/** One colour an element is drawn with, as a `#rrggbbaa` key. */
export type ColorSample = {
	role: ColorRole;
	color: string;
};

type Style = Map<string, unknown>;

const BORDER_KEYS = [
	'borderColor',
	'borderTopColor',
	'borderRightColor',
	'borderBottomColor',
	'borderLeftColor',
	'borderStartColor',
	'borderEndColor',
];

// UNKNOWN: see `HostProps.style`. Later entries win, as in React Native.
function flatten(style: unknown, into: Style = new Map()): Style {
	if (Array.isArray(style)) {
		for (const entry of style) flatten(entry, into);
	} else if (style && typeof style === 'object') {
		for (const [key, value] of Object.entries(style)) into.set(key, value);
	}

	return into;
}

// UNKNOWN: see `colorKey`.
function firstColor(values: unknown[]): string | undefined {
	for (const value of values) {
		const key = colorKey(value);

		if (key) {
			return key;
		}
	}

	return undefined;
}

// Stops at the first hit, so a tap deep in a screen flattens only the styles it climbs past.
function nearestBackground(chain: readonly HostProps[]): string | undefined {
	for (const props of chain) {
		const key = colorKey(flatten(props.style).get('backgroundColor'));

		if (key) {
			return key;
		}
	}

	return undefined;
}

/**
 * @description Reads an element's text, icon and border colours, and the nearest background at or behind it.
 * @param chain The element's props, then each drawn ancestor's, nearest first.
 * @returns One sample per role found, in the order text, icon, border, background.
 */
export function sampleColors(chain: readonly HostProps[]): ColorSample[] {
	const [own] = chain;

	if (!own) {
		return [];
	}

	const style = flatten(own.style);
	const found: [ColorRole, string | undefined][] = [
		['text', colorKey(style.get('color'))],
		['icon', firstColor([style.get('tintColor'), own.tintColor, own.fill])],
		['border', firstColor(BORDER_KEYS.map((key) => style.get(key)))],
		['background', nearestBackground(chain)],
	];

	return found.flatMap(([role, color]) => (color ? [{ role, color }] : []));
}
