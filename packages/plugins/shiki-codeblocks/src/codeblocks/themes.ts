import type { ParseError } from 'jsonc-parser';
import { parse } from 'jsonc-parser';

import { SHIKI_ASSET_COMMIT } from '~/constants';

export type ThemeDefinition = {
	[key: string]: unknown;
	colors?: Record<string, string>;
	include?: string;
	tokenColors?: unknown[];
	type?: 'dark' | 'light';
};

type ThemeResponse = {
	ok: boolean;
	status: number;
	text(): Promise<string>;
};

type ThemeFetcher = (url: string) => Promise<ThemeResponse>;

/**
 * @description Builds the URL of a theme: a bundled name, `material-candy`, or a user's `custom:<url>`.
 * @param name The theme name.
 * @returns The theme JSON URL.
 */
export function themeUrl(name: string): string {
	if (name.startsWith('custom:')) return name.slice('custom:'.length);

	if (name === 'material-candy') {
		return 'https://raw.githubusercontent.com/millsp/material-candy/master/material-candy.json';
	}

	return `https://cdn.jsdelivr.net/gh/shikijs/textmate-grammars-themes@${SHIKI_ASSET_COMMIT}/packages/tm-themes/themes/${encodeURIComponent(name)}.json`;
}

/**
 * @description Turns a theme ID into a title, such as `github-dark` into `Github Dark`.
 * @param name The theme ID.
 * @returns The title shown in settings.
 */
export function themeLabel(name: string): string {
	return name.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * @description Checks that a custom theme URL is an HTTPS link to a JSON file.
 * @param url The trimmed URL the user entered.
 * @returns `true` when the URL can be saved.
 */
export function isThemeUrl(url: string): boolean {
	return url.startsWith('https://') && /\.json(?:\?.*)?$/.test(url);
}

/**
 * @description Guesses from its name whether a theme is light, for use before the theme loads.
 * @param name The theme name.
 * @returns `true` for names such as `light`, `latte`, `dawn` or `ochin`.
 */
export function isLightTheme(name: string): boolean {
	return /(?:light|latte|dawn|ochin)/i.test(name);
}

/**
 * @description Downloads a VS Code theme, JSON with comments, and merges any `include` chain into it.
 * @param url The theme URL; it and every included URL must use HTTPS.
 * @param fetchTheme The fetch implementation.
 * @returns The merged theme, typed `dark` when it declares no type.
 */
export async function loadThemeDefinition(
	url: string,
	fetchTheme: ThemeFetcher = fetch,
): Promise<ThemeDefinition> {
	const definition = await resolveThemeDefinition(url, fetchTheme, new Set());

	return { ...definition, type: definition.type ?? 'dark' };
}

async function resolveThemeDefinition(
	url: string,
	fetchTheme: ThemeFetcher,
	visiting: Set<string>,
): Promise<ThemeDefinition> {
	const { href, protocol } = new URL(url);

	if (protocol !== 'https:') {
		throw new Error(`Theme URL must use HTTPS: ${url}`);
	}

	if (visiting.has(href)) {
		throw new Error(`Theme include cycle: ${href}`);
	}

	if (visiting.size >= 8) {
		throw new Error(`Theme include depth exceeded: ${href}`);
	}

	visiting.add(href);

	try {
		const response = await fetchTheme(href);

		if (!response.ok) {
			throw new Error(`Theme ${href} returned ${response.status}`);
		}

		const errors: ParseError[] = [];
		const parsed = parse(await response.text(), errors, { allowTrailingComma: true });

		if (errors.length || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error(`Theme ${href} is not valid JSON with comments`);
		}

		const { include, ...current } = parsed as ThemeDefinition;

		if (!include) return current;

		const included = await resolveThemeDefinition(
			new URL(include, href).href,
			fetchTheme,
			visiting,
		);

		return {
			...included,
			...current,
			colors: { ...included.colors, ...current.colors },
			tokenColors: [...(included.tokenColors ?? []), ...(current.tokenColors ?? [])],
		};
	} finally {
		visiting.delete(href);
	}
}

export default { themeUrl, themeLabel, isThemeUrl, isLightTheme, loadThemeDefinition };
