import type { Theme, ThemeSemanticColor } from '@unbound-app/types';

const THEME_TYPES: readonly Theme['type'][] = ['midnight', 'darker', 'light'];

type ThemeBackground = NonNullable<Theme['background']>;

function isObject(value: unknown): value is object {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isThemeType(value: unknown): value is Theme['type'] {
	return THEME_TYPES.some((type) => type === value);
}

function isSemanticColor(value: unknown): value is ThemeSemanticColor {
	if (!isObject(value)) {
		return false;
	}

	const type: unknown = Reflect.get(value, 'type');
	const opacity: unknown = Reflect.get(value, 'opacity');

	return (
		(type === 'color' || type === 'raw') &&
		typeof Reflect.get(value, 'value') === 'string' &&
		(opacity === undefined || typeof opacity === 'number')
	);
}

// UNKNOWN: one section of a theme bundle's JSON.
function entriesOf<T>(section: unknown, accept: (value: unknown) => value is T): Record<string, T> {
	const result: Record<string, T> = {};

	if (!isObject(section)) {
		return result;
	}

	for (const [key, value] of Object.entries(section)) {
		if (accept(value)) {
			result[key] = value;
		}
	}

	return result;
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

// UNKNOWN: the `background` section of a theme bundle's JSON.
function parseBackground(value: unknown): ThemeBackground | undefined {
	if (!isObject(value)) return;

	const url: unknown = Reflect.get(value, 'url');
	const blur: unknown = Reflect.get(value, 'blur');
	const opacity: unknown = Reflect.get(value, 'opacity');

	if (typeof url !== 'string') return;

	return {
		url,
		...(typeof blur === 'number' ? { blur } : {}),
		...(typeof opacity === 'number' ? { opacity } : {}),
	};
}

/**
 * @description Parses a theme bundle the way the loader reads it: a missing or malformed section, or a
 * malformed colour, is left out rather than failing the theme.
 * @param bundle The bundle's JSON source.
 * @returns The theme; `type` falls back to `darker` when absent or unknown.
 */
export function parseThemeBundle(bundle: string): Theme {
	const value: unknown = JSON.parse(bundle);

	if (!isObject(value)) {
		throw new Error('A theme bundle must be a JSON object.');
	}

	const type: unknown = Reflect.get(value, 'type');
	const background = parseBackground(Reflect.get(value, 'background'));

	return {
		type: isThemeType(type) ? type : 'darker',
		semantic: entriesOf(Reflect.get(value, 'semantic'), isSemanticColor),
		raw: entriesOf(Reflect.get(value, 'raw'), isString),
		...(background ? { background } : {}),
	};
}

export default { parseThemeBundle };
