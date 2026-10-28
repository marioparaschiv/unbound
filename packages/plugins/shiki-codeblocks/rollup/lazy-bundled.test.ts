import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BUNDLED_LANGUAGES, BUNDLED_THEMES, bundledGrammar, bundledThemes } from '../src/bundled';
import { generateLazyBundled } from './lazy-bundled.mjs';

const directory = mkdtempSync(join(tmpdir(), 'shiki-lazy-bundled-'));

afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function loadGenerated() {
	const source = readFileSync(new URL('../src/bundled.ts', import.meta.url), 'utf8');
	const file = join(directory, 'bundled.mjs');

	writeFileSync(file, await generateLazyBundled(source));

	return import(file);
}

describe('the lazily parsed bundled grammars', () => {
	test('match the source module for every language, alias and theme', async () => {
		const generated = await loadGenerated();

		expect(generated.BUNDLED_LANGUAGES).toEqual([...BUNDLED_LANGUAGES]);
		expect(generated.BUNDLED_THEMES).toEqual([...BUNDLED_THEMES]);

		for (const language of BUNDLED_LANGUAGES) {
			for (const registration of bundledGrammar(language) ?? []) {
				for (const name of [registration.name, ...(registration.aliases ?? [])]) {
					expect(generated.bundledGrammar(name)).toEqual(bundledGrammar(name));
				}
			}
		}

		expect(generated.bundledThemes()).toEqual(bundledThemes());
		expect(generated.bundledGrammar('not-a-language')).toBeUndefined();
	});

	test('parse each registration once and keep it', async () => {
		const generated = await loadGenerated();

		expect(generated.bundledGrammar('ts')[0]).toBe(generated.bundledGrammar('typescript')[0]);
		expect(generated.bundledThemes()).toBe(generated.bundledThemes());
	});
});
