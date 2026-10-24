import { describe, expect, test } from 'bun:test';

import { isThemeUrl, loadThemeDefinition } from './themes';

function serve(themes: Record<string, string>, fetched: string[] = []) {
	return async (url: string) => {
		fetched.push(url);

		return { ok: true, status: 200, text: async () => themes[url] ?? '' };
	};
}

describe('loadThemeDefinition', () => {
	test('types a theme without a declared type as dark', async () => {
		const theme = await loadThemeDefinition(
			'https://themes.example/theme.json',
			serve({
				'https://themes.example/theme.json':
					'{"colors":{"editor.background":"#161616"},"tokenColors":[]}',
			}),
		);

		expect(theme.type).toBe('dark');
	});

	test('reads JSON with comments and merges a relative included theme', async () => {
		const fetched: string[] = [];
		const theme = await loadThemeDefinition(
			'https://themes.example/material.json',
			serve(
				{
					'https://themes.example/material.json':
						'{\n// Theme metadata\n"include":"./dark_vs.json",\n"colors":{"editor.foreground":"#eeeeee"},\n"tokenColors":[{"scope":"keyword","settings":{"foreground":"#ff0000"}}],\n}',
					'https://themes.example/dark_vs.json':
						'{"type":"dark","colors":{"editor.background":"#101010","editor.foreground":"#aaaaaa"},"tokenColors":[{"scope":"string","settings":{"foreground":"#00ff00"}}]}',
				},
				fetched,
			),
		);

		expect(fetched).toEqual([
			'https://themes.example/material.json',
			'https://themes.example/dark_vs.json',
		]);
		expect(theme.type).toBe('dark');
		expect(theme.colors).toEqual({
			'editor.background': '#101010',
			'editor.foreground': '#eeeeee',
		});
		expect(theme.tokenColors).toEqual([
			{ scope: 'string', settings: { foreground: '#00ff00' } },
			{ scope: 'keyword', settings: { foreground: '#ff0000' } },
		]);
	});

	test('rejects a theme that includes itself', async () => {
		const failure = await loadThemeDefinition(
			'https://themes.example/loop.json',
			serve({ 'https://themes.example/loop.json': '{"include":"./loop.json"}' }),
		).then(
			() => '',
			(error: Error) => error.message,
		);

		expect(failure).toContain('Theme include cycle');
	});
});

describe('isThemeUrl', () => {
	test('accepts only HTTPS links to JSON files', () => {
		expect(isThemeUrl('https://example.com/theme.json')).toBe(true);
		expect(isThemeUrl('https://example.com/theme.json?raw=1')).toBe(true);
		expect(isThemeUrl('http://example.com/theme.json')).toBe(false);
		expect(isThemeUrl('https://example.com/theme.yaml')).toBe(false);
	});
});
