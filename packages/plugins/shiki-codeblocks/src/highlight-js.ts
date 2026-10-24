import hljs from 'highlight.js/lib/common';
import type { ThemedToken } from 'shiki';

import { HLJS_SCOPE_COLORS, HTML_ENTITIES, Palette } from '~/constants';

type ScopeStyle = {
	color: string;
	fontStyle: number;
};

function decodeHtml(text: string): string {
	return text.replace(/&(?:amp|lt|gt|quot|apos|#(?:x[\da-f]+|\d+));/gi, (entity) => {
		const name = entity.slice(1, -1).toLowerCase();

		if (HTML_ENTITIES[name]) return HTML_ENTITIES[name];

		const value = name.startsWith('#x')
			? Number.parseInt(name.slice(2), 16)
			: Number.parseInt(name.slice(1), 10);

		return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
	});
}

function scopeStyle(scopes: string[][], light: boolean): ScopeStyle {
	let color = Palette[light ? 'light' : 'dark'].hljsForeground;
	let fontStyle = 0;

	for (const classes of scopes) {
		for (const className of classes) {
			const scope = className.replace(/^hljs-/, '').split('-', 1)[0];
			const palette = HLJS_SCOPE_COLORS[scope];

			if (palette) color = palette[light ? 0 : 1];

			if (scope === 'emphasis') fontStyle |= 1;

			if (scope === 'strong' || scope === 'section') fontStyle |= 2;
		}
	}

	return { color, fontStyle };
}

function plainTokens(code: string, light: boolean): ThemedToken[][] {
	const color = Palette[light ? 'light' : 'dark'].hljsForeground;

	return code
		.split('\n')
		.map((content) => (content ? [{ color, content, fontStyle: 0, offset: 0 }] : []));
}

/**
 * @description Checks whether Highlight.js has a grammar for a language.
 * @param language The language name or alias.
 * @returns `true` when Highlight.js can highlight it.
 */
export function hasHighlightLanguage(language: string): boolean {
	return Boolean(hljs.getLanguage(language));
}

/**
 * @description Names a language the way Highlight.js does.
 * @param language The language name or alias.
 * @returns Its display name, or `undefined` when Highlight.js does not know it.
 */
export function highlightLanguageLabel(language: string): string | undefined {
	return hljs.getLanguage(language)?.name;
}

/**
 * @description Applies the "Highlighting preference" setting to one code block.
 * @param language The fence's language, `''` when it had none.
 * @param shikiSupported Whether Shiki has a grammar for it.
 * @param preference `never`, `secondary` (prefer Shiki), `primary` (prefer Highlight.js) or `always`.
 * @returns `true` when Highlight.js should color the block.
 */
export function shouldUseHighlightJs(
	language: string,
	shikiSupported: boolean,
	preference: string,
): boolean {
	switch (preference) {
		case 'always':
			return true;
		case 'primary':
			return hasHighlightLanguage(language) || language === '';
		case 'secondary':
			return !shikiSupported && hasHighlightLanguage(language);
		default:
			return false;
	}
}

/**
 * @description Highlights code with Highlight.js into the same per-line token shape Shiki produces.
 * @param code The code.
 * @param language The Highlight.js language; an unknown one yields uncolored lines.
 * @param light Whether to use the light palette.
 * @returns The tokens of each line.
 */
export function highlightCodeToTokens(
	code: string,
	language: string,
	light: boolean,
): ThemedToken[][] {
	if (!hasHighlightLanguage(language)) return plainTokens(code, light);

	let html: string;

	try {
		html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
	} catch {
		return plainTokens(code, light);
	}

	const lines: ThemedToken[][] = [[]];
	const scopes: string[][] = [];
	let offset = 0;

	for (const [fragment] of html.matchAll(/<[^>]*>|[^<]+/g)) {
		if (fragment.startsWith('<span ')) {
			scopes.push(/\bclass="([^"]+)"/.exec(fragment)?.[1].split(/\s+/) ?? []);
			continue;
		}

		if (fragment === '</span>') {
			scopes.pop();
			continue;
		}

		if (fragment.startsWith('<')) {
			continue;
		}

		const { color, fontStyle } = scopeStyle(scopes, light);

		for (const [index, part] of decodeHtml(fragment).split('\n').entries()) {
			if (index > 0) {
				lines.push([]);
				offset = 0;
			}

			if (!part) {
				continue;
			}

			lines.at(-1)?.push({ color, content: part, fontStyle, offset });
			offset += part.length;
		}
	}

	return lines;
}

export default {
	hasHighlightLanguage,
	highlightLanguageLabel,
	shouldUseHighlightJs,
	highlightCodeToTokens,
};
