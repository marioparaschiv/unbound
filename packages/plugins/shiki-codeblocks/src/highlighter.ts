import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import type { HighlighterCore, ThemedToken } from 'shiki';
import typescript from '@shikijs/langs/typescript';
import javascript from '@shikijs/langs/javascript';
import { createHighlighterCore } from 'shiki/core';
import lightPlus from '@shikijs/themes/light-plus';
import darkPlus from '@shikijs/themes/dark-plus';
import markdown from '@shikijs/langs/markdown';
import python from '@shikijs/langs/python';
import kotlin from '@shikijs/langs/kotlin';
import swift from '@shikijs/langs/swift';
import jsonc from '@shikijs/langs/jsonc';
import java from '@shikijs/langs/java';
import html from '@shikijs/langs/html';
import rust from '@shikijs/langs/rust';
import yaml from '@shikijs/langs/yaml';
import bash from '@shikijs/langs/bash';
import json from '@shikijs/langs/json';
import css from '@shikijs/langs/css';
import cpp from '@shikijs/langs/cpp';
import sql from '@shikijs/langs/sql';
import tsx from '@shikijs/langs/tsx';
import go from '@shikijs/langs/go';
import c from '@shikijs/langs/c';

import { getLanguageMetadata, grammarUrl } from '~/catalog';
import { highlightCodeToTokens, shouldUseHighlightJs } from '~/highlight-js';
import { isLightTheme, loadThemeDefinition, themeUrl } from '~/themes';
import { Limits, Palette, PLUGIN_NAME } from '~/constants';
import type { CodeBlock } from '~/fences';

type ThemeInput = Parameters<HighlighterCore['loadTheme']>[0];
type GrammarInput = Parameters<HighlighterCore['loadLanguage']>[0];

export type TokenLines = ThemedToken[][];

export type ThemeAppearance = {
	background: string;
	foreground: string;
	light: boolean;
};

export type Highlighter = ReturnType<typeof createHighlighter>;

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
 * @returns `appearance` reads a theme's card colors, `tokenize` highlights a code block.
 */
export function createHighlighter() {
	const bundledGrammars = new Map<string, GrammarInput>();
	const pendingGrammars = new Map<string, Promise<void>>();
	const pendingThemes = new Map<string, Promise<void>>();
	const tokenCache = new Map<string, TokenLines>();
	let core: Promise<HighlighterCore | null> | null = null;
	let loaded: HighlighterCore | null = null;

	for (const grammar of [
		bash,
		c,
		cpp,
		css,
		go,
		html,
		java,
		javascript,
		json,
		jsonc,
		kotlin,
		markdown,
		python,
		rust,
		sql,
		swift,
		tsx,
		typescript,
		yaml,
	]) {
		for (const language of grammar) {
			for (const name of [language.name, ...(language.aliases ?? [])]) {
				bundledGrammars.set(name, grammar);
			}
		}
	}

	function getCore() {
		core ??= createHighlighterCore({
			langs: [],
			themes: [darkPlus, lightPlus],
			engine: createJavaScriptRegexEngine({ target: 'ES2018', forgiving: true }),
		})
			.then((highlighter) => (loaded = highlighter))
			.catch((error) => {
				console.error(
					`[${PLUGIN_NAME}] Failed to initialize the Shiki highlighter:`,
					error,
				);

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
			const grammar = bundledGrammars.get(language) ?? fetchGrammar(language);

			pending = Promise.resolve(grammar)
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
			pending = loadThemeDefinition(themeUrl(theme))
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

		const highlighter = await getCore();

		if (!highlighter) return null;

		await Promise.all([loadGrammar(highlighter, language), loadTheme(highlighter, theme)]);

		const tokens = highlighter.codeToTokensBase(code, { lang: language, theme });

		remember(key, tokens);

		return tokens;
	}

	async function tokenize(
		block: CodeBlock,
		theme: string,
		hljsPreference: string,
	): Promise<TokenLines | null> {
		const language = block.sourceLanguage ?? (block.language === 'plain' ? '' : block.language);

		if (!shouldUseHighlightJs(language, block.language !== 'plain', hljsPreference)) {
			return shikiTokens(block.code, block.language, theme);
		}

		const { light } = appearance(theme);
		const key = `${light ? 'light' : 'dark'}\u0000hljs:${language}\u0000${block.code}`;
		const cached = tokenCache.get(key);

		if (cached) return cached;

		const tokens = highlightCodeToTokens(block.code, language, light);

		remember(key, tokens);

		return tokens;
	}

	return { appearance, tokenize };
}

export default { createHighlighter };
