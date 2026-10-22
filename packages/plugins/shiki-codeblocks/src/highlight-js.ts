import hljs from 'highlight.js/lib/common';
import type { ThemedToken } from 'shiki';

type TokenLines = ThemedToken[][];
type ScopeStyle = { color: string; fontStyle: number };

const SCOPE_COLORS: Record<string, readonly [string, string]> = {
	addition: ['#22863a', '#aff5b4'],
	attr: ['#005cc5', '#79c0ff'],
	attribute: ['#005cc5', '#79c0ff'],
	bullet: ['#735c0f', '#f2cc60'],
	built_in: ['#e36209', '#ffa657'],
	code: ['#6a737d', '#8b949e'],
	comment: ['#6a737d', '#8b949e'],
	deletion: ['#b31d28', '#ffdcd7'],
	doctag: ['#d73a49', '#ff7b72'],
	formula: ['#6a737d', '#8b949e'],
	keyword: ['#d73a49', '#ff7b72'],
	literal: ['#005cc5', '#79c0ff'],
	meta: ['#005cc5', '#79c0ff'],
	name: ['#22863a', '#7ee787'],
	number: ['#005cc5', '#79c0ff'],
	operator: ['#005cc5', '#79c0ff'],
	quote: ['#22863a', '#7ee787'],
	regexp: ['#032f62', '#a5d6ff'],
	section: ['#005cc5', '#1f6feb'],
	selector: ['#22863a', '#7ee787'],
	string: ['#032f62', '#a5d6ff'],
	subst: ['#24292e', '#c9d1d9'],
	symbol: ['#e36209', '#ffa657'],
	template: ['#d73a49', '#ff7b72'],
	title: ['#6f42c1', '#d2a8ff'],
	type: ['#d73a49', '#ff7b72'],
	variable: ['#005cc5', '#79c0ff'],
};

function decodeHtml(text: string): string {
	return text.replace(/&(?:amp|lt|gt|quot|apos|#(?:x[\da-f]+|\d+));/gi, (entity) => {
		const name = entity.slice(1, -1).toLowerCase();
		if (name === 'amp') return '&';
		if (name === 'lt') return '<';
		if (name === 'gt') return '>';
		if (name === 'quot') return '"';
		if (name === 'apos') return "'";
		const value = name.startsWith('#x')
			? Number.parseInt(name.slice(2), 16)
			: Number.parseInt(name.slice(1), 10);
		return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
	});
}

function scopeStyle(scopes: string[][], light: boolean): ScopeStyle {
	const colorIndex = light ? 0 : 1;
	let color = light ? '#24292e' : '#c9d1d9';
	let fontStyle = 0;
	for (const classes of scopes) {
		for (const className of classes) {
			const scope = className.replace(/^hljs-/, '').split('-', 1)[0];
			const palette = SCOPE_COLORS[scope];
			if (palette) color = palette[colorIndex];
			if (scope === 'emphasis') fontStyle |= 1;
			if (scope === 'strong' || scope === 'section') fontStyle |= 2;
		}
	}
	return { color, fontStyle };
}

export function hasHighlightLanguage(language: string): boolean {
	return Boolean(hljs.getLanguage(language));
}

export function highlightLanguageLabel(language: string): string | undefined {
	return hljs.getLanguage(language)?.name;
}

export function shouldUseHighlightJs(
	language: string,
	shikiSupported: boolean,
	setting: string,
): boolean {
	if (setting === 'always') return true;
	if (setting === 'never') return false;
	const hljsSupported = hasHighlightLanguage(language);
	if (setting === 'primary') return hljsSupported || language === '';
	if (setting === 'secondary') return !shikiSupported && hljsSupported;
	return false;
}

function plainTokens(code: string, light: boolean): TokenLines {
	const color = light ? '#24292e' : '#c9d1d9';
	return code
		.split('\n')
		.map((content) => (content ? [{ color, content, fontStyle: 0, offset: 0 }] : []));
}

export function highlightCodeToTokens(code: string, language: string, light: boolean): TokenLines {
	if (!hasHighlightLanguage(language)) return plainTokens(code, light);
	const lines: TokenLines = [[]];
	let html: string;
	try {
		html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
	} catch {
		return plainTokens(code, light);
	}
	const scopes: string[][] = [];
	let offset = 0;
	for (const match of html.matchAll(/<[^>]*>|[^<]+/g)) {
		const fragment = match[0];
		if (fragment.startsWith('<span ')) {
			const classes = /\bclass="([^"]+)"/.exec(fragment)?.[1].split(/\s+/) ?? [];
			scopes.push(classes);
			continue;
		}
		if (fragment === '</span>') {
			scopes.pop();
			continue;
		}
		if (fragment.startsWith('<')) continue;
		const { color, fontStyle } = scopeStyle(scopes, light);
		for (const [index, part] of decodeHtml(fragment).split('\n').entries()) {
			if (index > 0) {
				lines.push([]);
				offset = 0;
			}
			if (!part) continue;
			lines[lines.length - 1].push({ color, content: part, fontStyle, offset });
			offset += part.length;
		}
	}
	return lines;
}
