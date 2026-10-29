import { describe, expect, mock, test } from 'bun:test';
import type { LanguageRegistration } from 'shiki';

mock.module('@unbound-app/api', () => ({ fs: {} }));

const { createHighlighter: createWithSource } = await import('./highlighter');

async function localRegistration(name: string): Promise<LanguageRegistration> {
	const grammar: LanguageRegistration[] = (await import(`@shikijs/langs/${name}`)).default;
	const registration = grammar.find((language) => language.name === name);

	if (!registration) throw new Error(`${name} is not a local registration`);

	return registration;
}

function createHighlighter() {
	return createWithSource(localRegistration);
}

function text(tokens: { content: string }[] | undefined) {
	return tokens?.map((token) => token.content).join('');
}

describe('createHighlighter', () => {
	test('passes plain code through untouched', async () => {
		const tokens = await createHighlighter().tokenize(
			{ code: 'plain value', language: 'plain' },
			'dark-plus',
			'secondary',
		);

		expect(text(tokens?.[0])).toBe('plain value');
	});

	test('tokenizes a bundled grammar with a bundled theme', async () => {
		const tokens = await createHighlighter().tokenize(
			{ code: 'const answer = 42;', language: 'typescript' },
			'dark-plus',
			'secondary',
		);

		expect(text(tokens?.[0])).toBe('const answer = 42;');
		expect(tokens?.[0].some((token) => token.color?.toUpperCase() !== '#D4D4D4')).toBe(true);
	});

	test('uses Highlight.js when preferred, cached per light or dark theme', async () => {
		const highlighter = createHighlighter();
		const block = { code: 'const value = 42;', language: 'javascript' };
		const dark = await highlighter.tokenize(block, 'dark-plus', 'primary');
		const darkAgain = await highlighter.tokenize(block, 'dark-plus', 'primary');
		const light = await highlighter.tokenize(block, 'light-plus', 'primary');

		expect(darkAgain).toBe(dark);
		expect(dark?.[0].some((token) => token.color === '#ff7b72')).toBe(true);
		expect(light?.[0].some((token) => token.color === '#d73a49')).toBe(true);
	});

	test('guesses a theme appearance from its name before it loads', () => {
		const highlighter = createHighlighter();

		expect(highlighter.appearance('github-light').light).toBe(true);
		expect(highlighter.appearance('github-dark')).toEqual({
			background: '#1e1e1e',
			foreground: '#d4d4d4',
			light: false,
		});
	});
	test('retries a grammar that failed to download before highlighting', async () => {
		let failures = 1;
		const flaky = async (name: string) => {
			if (failures-- > 0) throw new TypeError('Network request failed');

			return localRegistration(name);
		};
		const tokens = await createWithSource(flaky, [0]).tokenize(
			{ code: 'const answer = 42;', language: 'typescript' },
			'dark-plus',
			'secondary',
		);
		const colors = new Set(tokens?.[0].map((token) => token.color));

		expect(colors.size).toBeGreaterThan(1);
	});

	test('gives up once its retries run out, so the next block tries again', async () => {
		let attempts = 0;
		const offline = async () => {
			attempts++;
			throw new TypeError('Network request failed');
		};
		const highlighter = createWithSource(offline, [0]);
		const block = { code: 'const answer = 42;', language: 'typescript' };

		await expect(highlighter.tokenize(block, 'dark-plus', 'secondary')).rejects.toThrow();
		await expect(highlighter.tokenize(block, 'dark-plus', 'secondary')).rejects.toThrow();
		expect(attempts).toBe(4);
	});
});
