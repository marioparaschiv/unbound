import { createLogger } from '@unbound-app/logger';
import type { Theme } from '@unbound-app/types';
import { cloneElement } from 'react';

import { findRootThemeProvider, mapThemeProvider } from '~/lib/root-theme-provider';
import { addListener, find, findByProps, findStore } from '~/api/metro';
import type { RootThemeElement } from '~/lib/root-theme-provider';
import { resolveThemeColor } from '~/lib/theme-colors';
import { createPatcher } from '~/api/patcher';
import type { AnyProps } from '~/api/metro';
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

type ThemedContext = {
	key: string;
};

type ExperimentsCopy = {
	source: string[] | undefined;
	revision: number;
	copy: string[];
};

let unsubscribe: (() => void) | null = null;
let restoreRaw: (() => void) | null = null;
let revision = 0;
let experiments: ExperimentsCopy | null = null;
let nativePreview: Theme | null = null;
let removeContextListener: (() => void) | null = null;

let patchedContexts = new WeakSet<AnyProps>();

// The editor's draft is its own slot over the applied theme, so a sync apply mid-edit never clobbers it.
function currentTheme() {
	const { preview, data } = ThemeStore.getState();

	return preview ?? data;
}

// The loader colours native surfaces (screen backgrounds, sheets) from disk at launch; the draft reaches them
// only through this call. Older loaders lack it and keep those surfaces on the saved theme.
function syncNativePreview() {
	const { preview } = ThemeStore.getState();

	if (preview === nativePreview) return;

	nativePreview = preview;
	globalThis.NativePlatform?.themes?.preview(preview ? JSON.stringify(preview) : null);
}

function applyRawColors(raw: Record<string, string>) {
	restoreRaw?.();
	restoreRaw = null;

	const theme = currentTheme();
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

function experimentsFor(source: string[] | undefined) {
	if (experiments && experiments.source === source && experiments.revision === revision) {
		return experiments.copy;
	}

	const next: ExperimentsCopy = { source, revision, copy: [...(source ?? [])] };

	experiments = next;

	return next.copy;
}

// Discord caches styles per context key and memoises the root context on its props; a new key and prop
// identity per theme revision make themed components recompute their colours.
function patchCreateThemedContext(mdl: AnyProps | undefined) {
	if (typeof mdl?.createThemedContext !== 'function' || patchedContexts.has(mdl)) return;

	patchedContexts.add(mdl);
	Patcher.after(mdl, 'createThemedContext', ({ result }) => {
		const themed: ThemedContext = result;

		return { ...themed, key: `${themed.key}#${revision}` };
	});
}

function patchThemeContext() {
	const root = findRootThemeProvider();

	if (!root) {
		Logger.error('Failed to find the root theme provider, so theme changes need a restart.');

		return;
	}

	// Design barrels re-export their own copy of the function and load after start, so each module that
	// exports it is patched as it loads; the root provider calls one of the barrels' copies.
	const loaded = find((mdl) => typeof mdl?.createThemedContext === 'function', {
		all: true,
		interop: false,
	});

	for (const mdl of loaded) patchCreateThemedContext(mdl);

	removeContextListener = addListener((mdl) => patchCreateThemedContext(mdl));

	Patcher.after(root, 'RootThemeContextProvider', ({ result }) => {
		const element: RootThemeElement = result;

		// Subscribes the root to theme changes; `revision` was already bumped by the store listener.
		ThemeStore((state) => state.preview ?? state.data);

		return mapThemeProvider(element, (provider) =>
			cloneElement(provider, {
				enabledExperiments: experimentsFor(provider.props.enabledExperiments),
			}),
		);
	});
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
			? resolveThemeColor(currentTheme(), name, tokens.unsafe_rawColors)
			: undefined;

		return color ?? original.apply(self, args);
	});

	applyRawColors(tokens.unsafe_rawColors);
	patchThemeContext();
	unsubscribe = ThemeStore.subscribe(() => {
		revision++;
		applyRawColors(tokens.unsafe_rawColors);
		syncNativePreview();
		refreshDiscordTheme();
	});
}

/** Restores Discord's colour tokens. */
export function stop() {
	unsubscribe?.();
	unsubscribe = null;
	removeContextListener?.();
	removeContextListener = null;
	patchedContexts = new WeakSet();

	if (nativePreview) {
		nativePreview = null;
		globalThis.NativePlatform?.themes?.preview(null);
	}

	restoreRaw?.();
	restoreRaw = null;
	Patcher.unpatchAll();
}

export default { start, stop };
