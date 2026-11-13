import { cloneElement, isValidElement, type ReactNode } from 'react';
import { createLogger } from '@unbound-app/logger';

import { byFilePath, byFluxStore, byProps } from '~/metro/filters';
import { clearGuardUnderlay } from '~/themes/clear-guard-underlay';
import { resolveChatBackground } from '~/themes/chat-background';
import { resolveThemeColor, withOpacity } from '~/themes/colors';
import { clearDMGreeting } from '~/themes/clear-dm-greeting';
import ThemeStore, { getShownTheme } from '~/themes/state';
import { createPatcher } from '~/patcher/create-patcher';
import type { SectionEntry } from '~/settings/section';
import ThemeEditorStore from '~/themes/editor-state';
import { getSetting } from '~/settings/unbound';
import { onModuleLoaded } from '~/metro/wait';
import { findStore } from '~/metro/lookups';
import { Screens } from '~/core/constants';
import { onChange } from '~/storage/api';

const Patcher = createPatcher('unbound::themes');
const Logger = createLogger('Themes');

type ThemedTokenValue = {
	raw?: string;
	opacity?: number;
};

type SemanticToken = Record<string, ThemedTokenValue>;

type ResolveOptions = {
	/** Set while colouring a user profile with its owner's profile theme. */
	isProfileTheme?: boolean;
};

type ColorTokens = {
	colors: Record<string, SemanticToken>;
	unsafe_rawColors: Record<string, string>;
	internal: {
		getSemanticColorName(color: SemanticToken): string | undefined;
		resolveSemanticColor(theme: string, color: SemanticToken, options?: ResolveOptions): string;
	};
};

// The patch reads only the rendered result, so the chat view's props stay untyped.
type ChatViewModule = { default: { type: () => ReactNode } };

/** Discord's chat screen; the chat colour behind its messages is `CHANNEL_BACKGROUND_DEFAULT`, used nowhere else. */
const CHAT_VIEW_PATH = 'modules/chat/native/ChatView.tsx';
const CHAT_COLOR = 'CHANNEL_BACKGROUND_DEFAULT';
/** The bar under the chat input: the bottom safe area, and the gap above an open keyboard. Tinted like the chat colour. */
const KEYBOARD_GAP_COLOR = 'MOBILE_KEYBOARD_GAP_BACKGROUND';
/** The fade Discord draws behind the chat input, over the bottom of the messages. */
const INPUT_SCRIM_PATH = 'modules/chat_input/native/ChatInputScrimGradient.tsx';

type InputScrimModule = { ChatInputScrimGradient: () => ReactNode };

let stopWaiting: (() => void) | null = null;
let stopWaitingForChat: (() => void) | null = null;
let stopWaitingForInputScrim: (() => void) | null = null;
let restoreDMGreeting: (() => void) | null = null;
let restoreGuardUnderlay: (() => void) | null = null;
let stopFollowingBackground: (() => void) | null = null;
let stopWaitingForStore: (() => void) | null = null;
let stopWaitingForProvider: (() => void) | null = null;
let unsubscribe: (() => void) | null = null;
let restoreRaw: (() => void) | null = null;
let restoreBaseTheme: (() => void) | null = null;

function applyRawColors(raw: Record<string, string>) {
	restoreRaw?.();
	restoreRaw = null;

	const theme = getShownTheme();
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

function syncBackground() {
	const { background, setBackground } = ThemeStore.getState();
	const next =
		resolveChatBackground(getShownTheme(), {
			source: getSetting('chat-background.source'),
			url: getSetting('chat-background.url'),
			blur: getSetting('chat-background.blur'),
			opacity: getSetting('chat-background.opacity'),
		}) ?? null;

	if (JSON.stringify(next) !== JSON.stringify(background)) {
		setBackground(next);
	}
}

// The chat view draws the image under its messages; the chat colour above it turns translucent to show it.
function drawChatBackground(mdl: ChatViewModule) {
	Patcher.after(mdl.default, 'type', ({ result }) => {
		// Required on render, so startup never evaluates the backdrop's UI.
		const { default: ChatBackdrop } = require('~/ui/themes/chat-backdrop');

		return <ChatBackdrop>{result}</ChatBackdrop>;
	});
}

// The fade would darken a chat background, so it hides while one is drawn. The original always renders, so its hooks
// run on every render whichever way the background flips.
function hideInputShadow(mdl: InputScrimModule) {
	Patcher.after(mdl, 'ChatInputScrimGradient', ({ result }) => {
		const hasBackground = ThemeStore((state) => Boolean(state.background));

		return hasBackground ? null : result;
	});
}

function refreshDiscordTheme() {
	// A theme store Discord has not loaded yet has nothing to refresh.
	findStore('Theme', { lazy: false, initialize: false })?.emitChange?.();
}

type DiscordThemeState = { theme: string };

type DiscordThemeStore = DiscordThemeState & { getState(): DiscordThemeState };

type ThemeContextProps = { enabledExperiments?: string[] };

type ThemeContextModule = {
	RootThemeContextProvider: (props: ThemeContextProps) => ReactNode;
};

type ProviderProps = { children?: ReactNode };

type TaggedExperiments = { id: string; tagged: string[] };

// Answering with the base runs Discord's own theme switch, which tells native via `useNativeThemeUpdater`.
// Discord compares theme names with `===`, so the answer is always a name it knows.
function overrideBaseTheme(store: DiscordThemeStore) {
	const prototype: DiscordThemeStore = Object.getPrototypeOf(store);
	const discordTheme = () => Reflect.get(prototype, 'theme', store);

	Object.defineProperty(store, 'theme', {
		configurable: true,
		get: () => getShownTheme()?.type ?? discordTheme(),
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
// The chat background and each draft change recolour too, so they tag it as well.
function tagThemeContext(mdl: ThemeContextModule) {
	Patcher.before(mdl, 'RootThemeContextProvider', ({ args }) => {
		const id = ThemeStore((state) => state.applied);
		const draft = ThemeStore((state) => (state.preview ? state.revision : 0));
		const background = ThemeStore((state) => state.background);
		const [props] = args;
		const tag = [
			id,
			draft && `draft${draft}`,
			background && `${background.url}@${background.opacity}`,
		]
			.filter(Boolean)
			.join(':');

		if (!tag) return;

		args[0] = { ...props, enabledExperiments: tagExperiments(props.enabledExperiments, tag) };
	});
}

// Shown while a theme edit is open and no editor screen is, so the user can return to it from anywhere.
function ThemeEditorButtonSlot() {
	const shown = ThemeEditorStore((state) => state.session !== null && state.mounted === 0);

	if (!shown) return null;

	// Required on render, so startup never evaluates the editor's UI.
	const { default: ThemeEditorButton } = require('~/ui/theme-editor/theme-editor-button');

	return <ThemeEditorButton />;
}

// Inside the root theme context, so the button draws with Discord's theme. The slot is always there, so
// starting an edit never remounts the app below it.
function mountEditorButton(mdl: ThemeContextModule) {
	Patcher.after(mdl, 'RootThemeContextProvider', ({ result }) => {
		if (!isValidElement<ProviderProps>(result)) {
			return result;
		}

		return cloneElement(result, {
			children: (
				<>
					{result.props.children}
					<ThemeEditorButtonSlot />
				</>
			),
		});
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
		(mdl) => {
			tagThemeContext(mdl);
			mountEditorButton(mdl);
		},
	);
	stopWaitingForChat = onModuleLoaded(byFilePath(CHAT_VIEW_PATH), drawChatBackground);
	stopWaitingForInputScrim = onModuleLoaded(byFilePath(INPUT_SCRIM_PATH), hideInputShadow);
	restoreDMGreeting = clearDMGreeting();
	restoreGuardUnderlay = clearGuardUnderlay();
	syncBackground();
	stopFollowingBackground = onChange(
		({ key }) => Boolean(key?.startsWith('chat-background.')),
		syncBackground,
	);
}

function recolor(tokens: ColorTokens | undefined) {
	const resolver = tokens?.internal;

	if (!tokens || typeof resolver?.resolveSemanticColor !== 'function') {
		Logger.error('Failed to find the semantic colour resolver.');

		return;
	}

	Patcher.instead(resolver, 'resolveSemanticColor', ({ args, original, this: self }) => {
		const [base, token, options] = args;
		const { background } = ThemeStore.getState();
		const theme = getShownTheme();
		const name = resolver.getSemanticColorName(token);
		// Another base, such as the picker previewing a light theme, keeps Discord's colours: the theme's text
		// would be unreadable there. A profile theme keeps its owner's colours.
		const themed =
			name && theme?.type === base && !options?.isProfileTheme
				? resolveThemeColor(theme, name, tokens.unsafe_rawColors)
				: undefined;
		const color = themed ?? original.apply(self, args);

		if (!background) {
			return color;
		}

		return name === CHAT_COLOR || name === KEYBOARD_GAP_COLOR
			? withOpacity(color, 1 - background.opacity)
			: color;
	});

	applyRawColors(tokens.unsafe_rawColors);
	unsubscribe = ThemeStore.subscribe((state, previous) => {
		if (state.data !== previous.data || state.preview !== previous.preview) {
			applyRawColors(tokens.unsafe_rawColors);
			syncBackground();
		}

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
	stopWaitingForChat?.();
	stopWaitingForChat = null;
	stopWaitingForInputScrim?.();
	stopWaitingForInputScrim = null;
	restoreDMGreeting?.();
	restoreDMGreeting = null;
	restoreGuardUnderlay?.();
	restoreGuardUnderlay = null;
	stopFollowingBackground?.();
	stopFollowingBackground = null;
	ThemeEditorStore.getState().end();
	ThemeStore.getState().setBackground(null);
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
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/design').default,
	icon: 'PaintPaletteIcon',
};

/** One font group's page, opened from the Fonts tab; its title is the group. */
export const fontGroupSection: SectionEntry = {
	key: Screens.FontGroup,
	titleKey: 'UNBOUND_FONTS',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/design/font-group-page').default,
	hidden: true,
};

/** One weight of a font group set along a variable font's axes, opened from that group's page. */
export const fontAxesSection: SectionEntry = {
	key: Screens.FontAxes,
	titleKey: 'UNBOUND_FONTS',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/settings/design/font-axes-page').default,
	hidden: true,
};

/** The theme editor, opened from the Themes tab's install menu, a local theme's Edit, or the floating button. */
export const themeEditorSection: SectionEntry = {
	key: Screens.ThemeEditor,
	titleKey: 'UNBOUND_THEME_EDITOR',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/theme-editor/theme-editor-page').default,
	hidden: true,
};

/** Every Discord colour of one group, opened from the theme editor's All Colors. */
export const themeColorsSection: SectionEntry = {
	key: Screens.ThemeColors,
	titleKey: 'UNBOUND_THEME_ALL_COLORS',
	/**
	 * @description Loads the page when it first opens.
	 * @returns The page.
	 */
	getComponent: () => require('~/ui/theme-editor/theme-colors-page').default,
	hidden: true,
};

export default {
	start,
	stop,
	designSection,
	fontGroupSection,
	fontAxesSection,
	themeEditorSection,
	themeColorsSection,
};
