import { createLogger } from '@unbound-app/logger';

import { resolveThemeColor } from '~/lib/theme-colors';
import { findByProps, findStore } from '~/api/metro';
import { createPatcher } from '~/api/patcher';
import ThemeStore from '~/stores/themes';

const Patcher = createPatcher('unbound::themes');
const Logger = createLogger('Themes');

type ThemedTokenValue = {
	raw?: string;
	opacity?: number;
};

type SemanticToken = Record<string, ThemedTokenValue>;

type ColorTokens = {
	colors: Record<string, SemanticToken>;
	unsafe_rawColors: Record<string, string>;
	internal: {
		getSemanticColorName(color: SemanticToken): string | undefined;
		resolveSemanticColor(theme: string, color: SemanticToken, saturation?: number): string;
	};
};

let unsubscribe: (() => void) | null = null;
let restoreRaw: (() => void) | null = null;

function applyRawColors(raw: Record<string, string>) {
	restoreRaw?.();
	restoreRaw = null;

	const theme = ThemeStore.getState().data;
	const overrides = Object.entries(theme?.raw ?? {}).filter(
		([name, value]) => typeof value === 'string' && name in raw,
	);

	if (!overrides.length || !Object.isExtensible(raw)) return;

	const originals = overrides.map(([name]) => [name, raw[name]] as const);

	for (const [name, value] of overrides) raw[name] = value;

	restoreRaw = () => {
		for (const [name, value] of originals) raw[name] = value;
	};
}

function refreshDiscordTheme() {
	findStore('Theme')?.emitChange?.();
}

/** Recolours Discord's JavaScript colour tokens with the applied theme and follows theme changes. */
export function start() {
	const tokens: ColorTokens | undefined = findByProps('SemanticColor')?.default;
	const resolver = tokens?.internal;

	if (!tokens || typeof resolver?.resolveSemanticColor !== 'function') {
		Logger.error('Failed to find the semantic colour resolver.');

		return;
	}

	Patcher.instead(resolver, 'resolveSemanticColor', ({ args, original, this: self }) => {
		const name = resolver.getSemanticColorName(args[1]);
		const color = name
			? resolveThemeColor(ThemeStore.getState().data, name, tokens.unsafe_rawColors)
			: undefined;

		return color ?? original.apply(self, args);
	});

	applyRawColors(tokens.unsafe_rawColors);
	unsubscribe = ThemeStore.subscribe(() => {
		applyRawColors(tokens.unsafe_rawColors);
		refreshDiscordTheme();
	});
}

/** Restores Discord's colour tokens. */
export function stop() {
	unsubscribe?.();
	unsubscribe = null;
	restoreRaw?.();
	restoreRaw = null;
	Patcher.unpatchAll();
}

export default { start, stop };
