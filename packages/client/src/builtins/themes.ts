import { createLogger } from '@unbound-app/logger';

import { onModuleLoaded, findStore, filters } from '~/api/metro';
import { resolveThemeColor } from '~/lib/theme-colors';
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

let stopWaiting: (() => void) | null = null;
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
	// Runs only when the user changes theme, by which point Discord has loaded its theme store.
	findStore('Theme')?.emitChange?.();
}

/** Recolours Discord's JavaScript colour tokens with the applied theme once Discord loads them, and follows theme changes. */
export function start() {
	// Discord loads its colour tokens at launch; patching them as they load beats every read of them.
	stopWaiting = onModuleLoaded(filters.byProps('SemanticColor'), (mdl) => recolor(mdl.default));
}

function recolor(tokens: ColorTokens | undefined) {
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
	stopWaiting?.();
	stopWaiting = null;
	unsubscribe?.();
	unsubscribe = null;
	restoreRaw?.();
	restoreRaw = null;
	Patcher.unpatchAll();
}

export default { start, stop };
