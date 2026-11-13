import type { SemanticColorToken } from '@unbound-app/types/components';
import type { Theme as ThemeBundle } from '@unbound-app/types';

import { parseColor, type ParsedColor } from '~/themes/draft';
import { Theme as DiscordTheme } from '~/metro/stores';
import { Theme } from '~/metro/common';

const BASES: readonly ThemeBundle['type'][] = ['light', 'dark', 'darker', 'midnight'];

// The editor lists and resolves every token by name; nothing here is a style.
function colorTokens(): Record<string, SemanticColorToken> {
	// oxlint-disable-next-line unbound/no-inline-styles -- reads token names, not a style.
	return Theme?.colors ?? {};
}

/**
 * @description Reads the colour Discord draws a token with now, the editor's draft included.
 * @param name The token's name.
 * @returns The colour, or `undefined` for a token this build lacks or a colour in another form.
 */
export function readTokenColor(name: string): ParsedColor | undefined {
	const token = colorTokens()[name];

	if (!token) return;

	try {
		return parseColor(Theme.internal.resolveSemanticColor(DiscordTheme.theme, token));
	} catch {
		// A token this build cannot resolve shows no colour.
		return undefined;
	}
}

/**
 * @description Lists every colour token on this Discord build.
 * @returns The token names.
 */
export function tokenNames(): string[] {
	return Object.keys(colorTokens());
}

/**
 * @description Reads the appearance Discord shows now, which a theme made from scratch starts on.
 * @returns The appearance, `darker` when Discord's is unknown.
 */
export function currentBase(): ThemeBundle['type'] {
	return BASES.find((base) => base === DiscordTheme?.theme) ?? 'darker';
}
