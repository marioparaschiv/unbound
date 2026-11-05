import { createLogger } from '@unbound-app/logger';
import type { ReactNode } from 'react';

import { createPatcher } from '~/patcher/create-patcher';
import { byFluxStore, byProps } from '~/metro/filters';
import type { SectionEntry } from '~/settings/section';
import { resolveThemeColor } from '~/themes/colors';
import { onModuleLoaded } from '~/metro/wait';
import DesignPage from '~/ui/settings/design';
import { Screens } from '~/core/constants';
import { findStore } from '~/metro/search';
import ThemeStore from '~/themes/state';

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
let stopWaitingForStore: (() => void) | null = null;
let stopWaitingForProvider: (() => void) | null = null;
let unsubscribe: (() => void) | null = null;
let restoreRaw: (() => void) | null = null;
let restoreBaseTheme: (() => void) | null = null;

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
	// A theme store Discord has not loaded yet has nothing to refresh.
	findStore('Theme', { initialize: false })?.emitChange?.();
}

type DiscordThemeState = { theme: string };

type DiscordThemeStore = DiscordThemeState & { getState(): DiscordThemeState };

type ThemeContextProps = { enabledExperiments?: string[] };

type ThemeContextModule = { RootThemeContextProvider: (props: ThemeContextProps) => ReactNode };

type TaggedExperiments = { id: string; tagged: string[] };

// Answering with the base runs Discord's own theme switch, which tells native via `useNativeThemeUpdater`.
// Discord compares theme names with `===`, so the answer is always a name it knows.
function overrideBaseTheme(store: DiscordThemeStore) {
	const prototype: DiscordThemeStore = Object.getPrototypeOf(store);
	const discordTheme = () => Reflect.get(prototype, 'theme', store);

	Object.defineProperty(store, 'theme', {
		configurable: true,
		get: () => ThemeStore.getState().data?.type ?? discordTheme(),
	});

	// `persist` and the cache snapshot save `getState()`, which reads `theme`; they keep Discord's own.
	Patcher.after(store, 'getState', ({ result }) => ({ ...result, theme: discordTheme() }));

	return () => {
		Reflect.deleteProperty(store, 'theme');
	};
}

const taggedExperiments = new WeakMap<string[], TaggedExperiments>();
const noExperiments: string[] = [];

// `ThemeContext.key` is the JSON of these props and keys every style cache, so the tag gives each theme its own.
function tagExperiments(experiments: string[] = noExperiments, id: string) {
	const cached = taggedExperiments.get(experiments);

	if (cached?.id === id) {
		return cached.tagged;
	}

	const tagged = [...experiments, `unbound-theme:${id}`];

	taggedExperiments.set(experiments, { id, tagged });

	return tagged;
}

// Two themes on one base share Discord's theme name, so the applied id tags the root theme context instead.
function tagThemeContext(mdl: ThemeContextModule) {
	Patcher.before(mdl, 'RootThemeContextProvider', ({ args }) => {
		const id = ThemeStore((state) => state.applied);
		const [props] = args;

		if (!id) return;

		args[0] = { ...props, enabledExperiments: tagExperiments(props.enabledExperiments, id) };
	});
}

/** Recolours Discord's JavaScript colour tokens with the applied theme once Discord loads them, and follows theme changes. */
export function start() {
	// Discord loads its colour tokens at launch; patching them as they load beats every read of them.
	stopWaiting = onModuleLoaded(byProps('SemanticColor'), (mdl) => recolor(mdl.default));
	stopWaitingForStore = onModuleLoaded(byFluxStore('Theme'), (store) => {
		restoreBaseTheme = overrideBaseTheme(store);
	});
	stopWaitingForProvider = onModuleLoaded(
		byProps('RootThemeContextProvider', 'DisableCustomTheme'),
		tagThemeContext,
	);
}

function recolor(tokens: ColorTokens | undefined) {
	const resolver = tokens?.internal;

	if (!tokens || typeof resolver?.resolveSemanticColor !== 'function') {
		Logger.error('Failed to find the semantic colour resolver.');

		return;
	}

	Patcher.instead(resolver, 'resolveSemanticColor', ({ args, original, this: self }) => {
		const [base, token] = args;
		const theme = ThemeStore.getState().data;
		// Another base, such as the picker previewing a light theme over a dark one, keeps Discord's colours for it:
		// the theme's text would be unreadable there.
		const name = theme?.type === base ? resolver.getSemanticColorName(token) : undefined;
		const color = name ? resolveThemeColor(theme, name, tokens.unsafe_rawColors) : undefined;

		return color ?? original.apply(self, args);
	});

	applyRawColors(tokens.unsafe_rawColors);
	unsubscribe = ThemeStore.subscribe(() => {
		applyRawColors(tokens.unsafe_rawColors);
		refreshDiscordTheme();
	});
}

/** Restores Discord's colour tokens and theme name. */
export function stop() {
	stopWaiting?.();
	stopWaiting = null;
	stopWaitingForStore?.();
	stopWaitingForStore = null;
	stopWaitingForProvider?.();
	stopWaitingForProvider = null;
	restoreBaseTheme?.();
	restoreBaseTheme = null;
	refreshDiscordTheme();
	unsubscribe?.();
	unsubscribe = null;
	restoreRaw?.();
	restoreRaw = null;
	Patcher.unpatchAll();
}

export const designSection: SectionEntry = {
	key: Screens.Design,
	titleKey: 'UNBOUND_DESIGN',
	component: DesignPage,
	icon: 'PaintPaletteIcon',
};

export default { start, stop, designSection };
