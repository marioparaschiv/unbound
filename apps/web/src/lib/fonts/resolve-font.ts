import type { ResolvedFont } from '@unbound-app/contracts/fonts';

import { ApiError } from '~/lib/api/errors';

import type { FontFetch, FontSource } from './font-source';

import googleFonts, { GOOGLE_FAMILY } from './google-fonts';
import fontsquirrel from './fontsquirrel';
import directFonts from './direct-fonts';
import githubFonts from './github-fonts';
import fontsource from './fontsource';
import fontshare from './fontshare';
import dafont from './dafont';

/** Tried in order; the catch-all direct link comes last. */
const SOURCES: readonly FontSource[] = [
	googleFonts,
	fontsource,
	fontshare,
	fontsquirrel,
	dafont,
	githubFonts,
	directFonts,
];

// A link typed without its scheme, such as `fonts.google.com/specimen/Inter`.
const BARE_LINK = /^[\w-]+(?:\.[\w-]+)+\//;

function readLink(input: string): URL | undefined {
	const link = BARE_LINK.test(input) ? `https://${input}` : input;

	if (!URL.canParse(link)) return;

	const url = new URL(link);

	return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
}

function findSource(input: string): [FontSource, string] | undefined {
	const url = readLink(input);

	if (!url) {
		return GOOGLE_FAMILY.test(input) ? [googleFonts, input] : undefined;
	}

	for (const source of SOURCES) {
		const id = source.match(url);

		if (id) {
			return [source, id];
		}
	}

	return undefined;
}

/**
 * @description Resolves a family name or a font link to the provider's own file URLs. Only fixed
 * provider APIs are fetched, with ids checked against each provider's pattern; other links pass through.
 * @param input A Google family name, a provider page, or a direct `.ttf`, `.otf` or `.zip` link.
 * @param fetch The fetch to ask providers with.
 * @returns The resolved font.
 */
export async function resolveFont(
	input: string,
	fetch: FontFetch = globalThis.fetch,
): Promise<ResolvedFont> {
	const text = input.trim();
	const found = findSource(text);

	if (!found) {
		throw new ApiError(
			'invalid_request',
			'Enter a Google Fonts family name or a link to a font page, .ttf, .otf, .woff, .woff2 or .zip file.',
		);
	}

	const [source, id] = found;
	const font = await source.resolve(id, fetch);

	if (!font) {
		throw new ApiError('not_found', `No ${source.provider} font was found for ${id}.`);
	}

	return font;
}

export default { resolveFont };
