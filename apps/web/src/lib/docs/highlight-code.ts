import type { HighlighterCore } from 'shiki/core';

/** One highlighted token: its text and the `--shiki-light` and `--shiki-dark` colours the stylesheet reads. */
export type HighlightedToken = {
	content: string;
	style: Record<string, string>;
};

// The TSX grammar covers TypeScript, JavaScript and JSX, so one grammar serves every script example.
const GRAMMARS: Record<string, string> = {
	ts: 'tsx',
	typescript: 'tsx',
	tsx: 'tsx',
	js: 'tsx',
	javascript: 'tsx',
	jsx: 'tsx',
	json: 'json',
};

let highlighter: Promise<HighlighterCore> | undefined;

// Loaded on first use, so only a page with an example downloads the grammars.
async function createHighlighter(): Promise<HighlighterCore> {
	const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
		import('shiki/core'),
		import('shiki/engine/javascript'),
	]);

	return createHighlighterCore({
		themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
		langs: [import('shiki/langs/tsx.mjs'), import('shiki/langs/json.mjs')],
		engine: createJavaScriptRegexEngine(),
	});
}

/**
 * @description Highlights a doc comment's code the way the guides' build does, with GitHub's light and dark themes.
 * An unfenced `@example` is TypeScript.
 * @param text The code.
 * @param language The fence's language.
 * @returns The lines of tokens, or `undefined` for a language without a grammar here.
 */
export async function highlightCode(
	text: string,
	language = 'ts',
): Promise<HighlightedToken[][] | undefined> {
	const grammar = GRAMMARS[language];

	if (!grammar) return;

	highlighter ??= createHighlighter();

	const { tokens } = (await highlighter).codeToTokens(text, {
		lang: grammar,
		themes: { light: 'github-light', dark: 'github-dark' },
		defaultColor: false,
	});

	return tokens.map((line) =>
		line.map((token) => ({ content: token.content, style: token.htmlStyle ?? {} })),
	);
}

export default { highlightCode };
