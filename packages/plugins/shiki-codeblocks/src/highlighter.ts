import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import type { HighlighterCore, ThemedToken } from 'shiki';
import { createHighlighterCore } from 'shiki/core';

import { getLanguageMetadata, grammarUrl } from '~/catalog';
import { loadBundledGrammar, type RegistrationSource } from '~/grammar-files';
import { bundledThemes } from '~/bundled';
import { highlightCodeToTokens, shouldUseHighlightJs } from '~/highlight-js';
import { isLightTheme, loadThemeDefinition, themeUrl } from '~/themes';
import { Limits, Palette, PLUGIN_NAME } from '~/constants';
import { expandTabs, type CodeBlock } from '~/fences';
import { sharedTokenStore, type TokenStore } from '~/token-store';

type ThemeInput = Parameters<HighlighterCore['loadTheme']>[0];
type GrammarInput = Parameters<HighlighterCore['loadLanguage']>[0];

export type TokenLines = ThemedToken[][];

export type ThemeAppearance = {
	background: string;
	foreground: string;
	light: boolean;
};

export type Highlighter = ReturnType<typeof createHighlighter>;

const LOAD_RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(load: () => Promise<T>, delays: number[]): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await load();
		} catch (error) {
			const delay = delays[attempt];

			if (delay === undefined) throw error;

			await wait(delay);
		}
	}
}

function isLightColor(hex: string): boolean | undefined {
	const rgb = hex.replace('#', '').slice(0, 6);

	if (!/^[\da-f]{6}$/i.test(rgb)) return;

	const red = Number.parseInt(rgb.slice(0, 2), 16);
	const green = Number.parseInt(rgb.slice(2, 4), 16);
	const blue = Number.parseInt(rgb.slice(4, 6), 16);

	return (red * 299 + green * 587 + blue * 114) / 1000 > 150;
}

/**
 * @description Creates a Shiki highlighter that loads grammars and themes on demand and caches recent tokens.
 * @param registrations Where bundled languages' registrations come from.
 * @param retryDelays How long to wait before each retry of a grammar or theme that failed to load.
 * @param store Where results are kept across restarts.
 * @returns `appearance` reads a theme's card colors, `tokenize` highlights a code block, and `warm` starts Shiki and loads a theme ahead of the first block.
 */
export function createHighlighter(
	registrations?: RegistrationSource,
	retryDelays: number[] = LOAD_RETRY_DELAYS_MS,
	store: TokenStore | undefined = sharedTokenStore(),
) {
	const pendingGrammars = new Map<string, Promise<void>>();
	const pendingThemes = new Map<string, Promise<void>>();
	const tokenCache = new Map<string, TokenLines>();
	let core: Promise<HighlighterCore | null> | null = null;
	let loaded: HighlighterCore | null = null;

	function getCore() {
		core ??= createHighlighterCore({
			langs: [],
			themes: bundledThemes(),
			engine: createJavaScriptRegexEngine({ target: 'ES2018', forgiving: true }),
		})
			.then((highlighter) => (loaded = highlighter))
			.catch((error) => {
				console.error(
					`[${PLUGIN_NAME}] Failed to initialize the Shiki highlighter:`,
					error,
				);
				core = null;

				return null;
			});

		return core;
	}

	function remember(key: string, tokens: TokenLines) {
		tokenCache.delete(key);
		tokenCache.set(key, tokens);

		if (tokenCache.size > Limits.tokenCacheEntries) {
			const [oldest] = tokenCache.keys();

			tokenCache.delete(oldest);
		}
	}

	async function fetchGrammar(language: string): Promise<GrammarInput> {
		const response = await fetch(grammarUrl(language));

		if (!response.ok) {
			throw new Error(`Grammar ${language} returned ${response.status}`);
		}

		const grammar = await response.json();

		return {
			...grammar,
			name: language,
			scopeName: getLanguageMetadata(language)?.scopeName ?? grammar.scopeName,
		};
	}

	function loadGrammar(highlighter: HighlighterCore, language: string): Promise<void> {
		if (highlighter.getLoadedLanguages().includes(language)) return Promise.resolve();

		let pending = pendingGrammars.get(language);

		if (!pending) {
			pending = withRetries(
				() =>
					loadBundledGrammar(language, registrations).then(
						(bundled) => bundled ?? fetchGrammar(language),
					),
				retryDelays,
			)
				.then((input) => highlighter.loadLanguage(input))
				.finally(() => pendingGrammars.delete(language));

			pendingGrammars.set(language, pending);
		}

		return pending;
	}

	function loadTheme(highlighter: HighlighterCore, theme: string): Promise<void> {
		if (highlighter.getLoadedThemes().includes(theme)) return Promise.resolve();

		let pending = pendingThemes.get(theme);

		if (!pending) {
			pending = withRetries(() => loadThemeDefinition(themeUrl(theme)), retryDelays)
				.then((definition) =>
					highlighter.loadTheme({ ...definition, name: theme } as ThemeInput),
				)
				.finally(() => pendingThemes.delete(theme));

			pendingThemes.set(theme, pending);
		}

		return pending;
	}

	function appearance(theme: string): ThemeAppearance {
		const guess = isLightTheme(theme);
		const palette = Palette[guess ? 'light' : 'dark'];

		if (!loaded) {
			return { background: palette.background, foreground: palette.foreground, light: guess };
		}

		const resolved = loaded.getLoadedThemes().includes(theme) ? loaded.getTheme(theme) : null;
		const background = resolved?.bg ?? palette.background;

		return {
			background,
			foreground: resolved?.fg ?? palette.foreground,
			light: isLightColor(background) ?? guess,
		};
	}

	async function shikiTokens(code: string, language: string, theme: string) {
		const key = `${theme}\u0000${language}\u0000${code}`;
		const cached = tokenCache.get(key);

		if (cached) return cached;

		if (language === 'plain') {
			const tokens = code
				.split('\n')
				.map((content) => [{ content, offset: 0, fontStyle: 0 }]);

			remember(key, tokens);

			return tokens;
		}

		if (store) {
			await store.ready;

			const stored = store.get(key);

			if (stored) {
				remember(key, stored);

				return stored;
			}
		}

		const highlighter = await getCore();

		if (!highlighter) return null;

		await Promise.all([loadGrammar(highlighter, language), loadTheme(highlighter, theme)]);

		const tokens = highlighter.codeToTokensBase(code, { lang: language, theme });

		remember(key, tokens);
		store?.set(key, tokens);

		return tokens;
	}

	async function tokenize(
		block: CodeBlock,
		theme: string,
		hljsPreference: string,
	): Promise<TokenLines | null> {
		const language = block.sourceLanguage ?? (block.language === 'plain' ? '' : block.language);
		const code = expandTabs(block.code);

		if (!shouldUseHighlightJs(language, block.language !== 'plain', hljsPreference)) {
			return shikiTokens(code, block.language, theme);
		}

		const { light } = appearance(theme);
		const key = `${light ? 'light' : 'dark'}\u0000hljs:${language}\u0000${code}`;
		const cached = tokenCache.get(key);

		if (cached) return cached;

		const tokens = highlightCodeToTokens(code, language, light);

		remember(key, tokens);

		return tokens;
	}

	function warm(theme: string) {
		void getCore()
			.then((highlighter) => (highlighter ? loadTheme(highlighter, theme) : undefined))
			.catch(() => undefined);
	}

	return { appearance, tokenize, warm };
}

export default { createHighlighter };
