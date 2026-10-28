import type { Theme as ThemeBundle } from '@unbound-app/types';

import { Theme as DiscordStore } from '~/api/metro/stores';
import { parseColor } from '~/lib/theme-draft';
import { Theme } from '~/api/metro/common';

const APPEARANCES: Record<string, ThemeBundle['type']> = {
	light: 'light',
	midnight: 'midnight',
};

/**
 * @description Reads what Discord draws for a semantic token now, through the patched resolver, so the
 * editor's draft is included.
 * @param name The token name.
 * @returns The colour string, or `''` for a token this build lacks.
 */
export function readTokenColor(name: string): string {
	const token = Theme.colors?.[name];

	if (!token) {
		return '';
	}

	try {
		return Theme.internal.resolveSemanticColor(DiscordStore.theme, token) ?? '';
	} catch {
		return '';
	}
}

/**
 * @description Reads the opacity Discord draws a token with now.
 * @param name The token name.
 * @returns The 0 to 1 opacity, or `undefined` when the colour can't be read.
 */
export function readTokenOpacity(name: string): number | undefined {
	return parseColor(readTokenColor(name))?.alpha;
}

/**
 * @description Maps Discord's current appearance to a theme bundle `type`.
 * @returns `light` or `midnight` when Discord shows those, `darker` for every other dark appearance.
 */
export function currentAppearance(): ThemeBundle['type'] {
	return APPEARANCES[DiscordStore.theme] ?? 'darker';
}

/**
 * @description Lists every semantic token on this Discord build.
 * @returns The token names.
 */
export function liveTokenNames(): string[] {
	return Object.keys(Theme.colors ?? {});
}

export default { readTokenColor, readTokenOpacity, currentAppearance, liveTokenNames };
