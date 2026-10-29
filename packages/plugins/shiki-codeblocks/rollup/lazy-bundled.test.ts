import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BUNDLED_LANGUAGES, BUNDLED_THEMES, bundledThemes, grammarOrder } from '../src/bundled';
import { generateLazyBundled } from './lazy-bundled.mjs';

const directory = mkdtempSync(join(tmpdir(), 'shiki-lazy-bundled-'));

afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function loadGenerated() {
	const source = readFileSync(new URL('../src/bundled.ts', import.meta.url), 'utf8');
	const file = join(directory, 'bundled.mjs');

	writeFileSync(file, await generateLazyBundled(source));

	return import(file);
}

describe('the bundled grammar index', () => {
	test('match the source module for every language, alias and theme', async () => {
		const generated = await loadGenerated();

		expect(generated.BUNDLED_LANGUAGES).toEqual([...BUNDLED_LANGUAGES]);
		expect(generated.BUNDLED_THEMES).toEqual([...BUNDLED_THEMES]);

		for (const language of BUNDLED_LANGUAGES) {
			expect(generated.grammarOrder(language)).toEqual(grammarOrder(language));
		}

		expect(generated.grammarOrder('ts')).toEqual(['typescript']);
		expect(generated.grammarOrder('html')).toEqual(['javascript', 'css', 'html']);
		expect(generated.bundledThemes()).toEqual(bundledThemes());
		expect(generated.grammarOrder('not-a-language')).toBeUndefined();
		expect(generated.grammarOrder('constructor')).toBeUndefined();
	});

	test('leave the grammars out of the bundle and parse the themes once', async () => {
		const source = readFileSync(new URL('../src/bundled.ts', import.meta.url), 'utf8');
		const generated = await loadGenerated();

		expect(await generateLazyBundled(source)).not.toContain('repository');
		expect(generated.bundledThemes()).toBe(generated.bundledThemes());
	});
});
