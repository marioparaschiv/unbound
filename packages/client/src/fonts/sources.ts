import type { UnboundFontPreset, UnboundFontSource } from '@unbound-app/types';
import type { JsonValue } from '@unbound-app/contracts/sync';

/** The providers a source names, in the order `@unbound-app/contracts/fonts` lists them. */
const PROVIDERS = [
	'google',
	'fontsource',
	'fontshare',
	'fontsquirrel',
	'dafont',
	'github',
	'url',
	'local',
] as const;

type SourceProvider = (typeof PROVIDERS)[number];

/** A JSON object, as pasted preset text parses to. */
type JsonRecord = { [key: string]: JsonValue };

/** The provider a source names, and its id there. */
export type SourceOrigin = {
	provider: SourceProvider;
	id: string;
};

/** A preset's shareable text, and the families left out for having a local font. */
export type PresetCopy = {
	text: string;
	dropped: string[];
};

/** What preset text a paste accepts before the loader validates it: a name and an overrides object. */
export type PastedPreset = {
	name: string;
	overrides: Record<string, UnboundFontSource>;
};

/**
 * @description Reads which provider a source names and its id there.
 * @param source The source.
 * @returns The provider and id, or `undefined` for a malformed source.
 */
export function sourceOrigin(source: UnboundFontSource): SourceOrigin | undefined {
	const ids: Partial<Record<SourceProvider, string>> = source;

	for (const provider of PROVIDERS) {
		const id = ids[provider];

		if (typeof id === 'string') {
			return { provider, id };
		}
	}

	return undefined;
}

/**
 * @description Builds the link that installs a source again, which Sync records as the install URL.
 * @param source The source.
 * @returns The provider's page or file link, or `undefined` for a local font.
 */
export function sourceLink(source: UnboundFontSource): string | undefined {
	const origin = sourceOrigin(source);

	switch (origin?.provider) {
		case 'google':
			return `https://fonts.google.com/specimen/${encodeURIComponent(origin.id)}`;
		case 'fontsource':
			return `https://fontsource.org/fonts/${origin.id}`;
		case 'fontshare':
			return `https://www.fontshare.com/fonts/${origin.id}`;
		case 'fontsquirrel':
			return `https://www.fontsquirrel.com/fonts/${origin.id}`;
		case 'dafont':
			return `https://www.dafont.com/${origin.id}.font`;
		case 'github':
		case 'url':
			return origin.id;
		default:
			return undefined;
	}
}

/**
 * @description Builds the text a preset copies as: its name and overrides, without the faces that
 * exist only on this device.
 * @param preset The preset.
 * @returns The JSON text, and the Discord families dropped for having a local font.
 */
export function presetCopy(preset: UnboundFontPreset): PresetCopy {
	const overrides: Record<string, UnboundFontSource> = {};
	const dropped: string[] = [];

	for (const [family, source] of Object.entries(preset.overrides)) {
		if (sourceOrigin(source)?.provider === 'local') {
			dropped.push(family);
		} else {
			overrides[family] = source;
		}
	}

	return { text: JSON.stringify({ name: preset.name, overrides }), dropped };
}

function isRecord(value: JsonValue | undefined): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// One provider key with a string id; the loader checks the id, weight and style when it saves.
function isFontSource(value: JsonValue | undefined): value is JsonRecord & UnboundFontSource {
	return (
		isRecord(value) &&
		PROVIDERS.filter((provider) => typeof value[provider] === 'string').length === 1
	);
}

/**
 * @description Reads pasted text as a preset's shape; the loader checks every source when it saves.
 * @param text The clipboard text.
 * @returns The preset, or `undefined` when the text is not one.
 */
export function readPastedPreset(text: string): PastedPreset | undefined {
	let value: JsonValue;

	try {
		value = JSON.parse(text);
	} catch {
		return undefined;
	}

	if (!isRecord(value) || typeof value.name !== 'string' || !isRecord(value.overrides)) {
		return undefined;
	}

	const overrides: Record<string, UnboundFontSource> = {};

	for (const [family, source] of Object.entries(value.overrides)) {
		if (!isFontSource(source)) {
			return undefined;
		}

		overrides[family] = source;
	}

	return { name: value.name, overrides };
}
