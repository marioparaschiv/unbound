import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { LanguageRegistration } from 'shiki';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const files = new Map<string, string>();

mock.module('@unbound-app/api', () => ({
	fs: {
		exists: async (path: string) => files.has(path),
		read: async (path: string) => files.get(path) ?? '',
		write: async (path: string, content: string) => void files.set(path, content),
	},
}));

const { cachedRegistration, grammarModuleUrl, loadBundledGrammar, registrationFromModule } =
	await import('./grammar-files');
const { SHIKI_LANGS_VERSION } = await import('./constants');

const langs = dirname(require.resolve('@shikijs/langs/package.json'));
const realFetch = globalThis.fetch;

function moduleSource(name: string) {
	return readFileSync(join(langs, 'dist', `${name}.mjs`), 'utf8');
}

async function localRegistration(name: string): Promise<LanguageRegistration> {
	const grammar: LanguageRegistration[] = (await import(`@shikijs/langs/${name}`)).default;

	return grammar.find((language) => language.name === name)!;
}

afterEach(() => {
	files.clear();
	globalThis.fetch = realFetch;
});

describe('grammar files', () => {
	test('pin the module URL to the Shiki version the plugin depends on', () => {
		const manifest = JSON.parse(readFileSync(join(import.meta.dir, '../package.json'), 'utf8'));

		expect(manifest.dependencies['@shikijs/langs']).toBe(SHIKI_LANGS_VERSION);
		expect(grammarModuleUrl('cpp')).toBe(
			`https://cdn.jsdelivr.net/npm/@shikijs/langs@${SHIKI_LANGS_VERSION}/dist/cpp.mjs`,
		);
	});

	test('read the same registration from a module that importing it gives', async () => {
		for (const name of ['html', 'markdown', 'typescript', 'cpp']) {
			expect(registrationFromModule(moduleSource(name))).toEqual(
				await localRegistration(name),
			);
		}
	});

	test('download a registration once, then read it from its file', async () => {
		const requests: string[] = [];

		globalThis.fetch = (async (url: string) => {
			requests.push(url);

			return new Response(moduleSource('css'));
		}) as unknown as typeof fetch;

		const first = await cachedRegistration('css');
		const second = await cachedRegistration('css');

		expect(requests).toEqual([grammarModuleUrl('css')]);
		expect(second).toEqual(first);
		expect([...files.keys()]).toEqual([
			`Unbound/cache/shiki-codeblocks/langs-${SHIKI_LANGS_VERSION}/css.json`,
		]);
	});

	test('load embedded languages first and skip languages that are not bundled', async () => {
		const loaded = await loadBundledGrammar('html', localRegistration);

		expect(loaded?.map((registration) => registration.name)).toEqual([
			'javascript',
			'css',
			'html',
		]);
		expect(await loadBundledGrammar('zig', localRegistration)).toBeUndefined();
	});
});
