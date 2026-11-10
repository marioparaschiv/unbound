import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, test } from 'bun:test';
import type { OutputAsset, RollupLog } from 'rollup';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';

import { readIcuArguments } from '../src/rollup/icu-arguments';
import { unbound } from '../src/rollup/preset';
import { runTsc } from '../src/lib/check/tsc';

type Built = { code: string; assets: Map<string, string>; warnings: string[] };

const roots: string[] = [];

const enUS = {
	TITLE: 'Welcome back',
	BODY: 'Hello, {name}!',
	COUNT: '{count, plural, one {# message} other {# messages}}',
	PRONOUN: '{who, select, he {him} she {her}}',
	WHEN: 'Sent {at, date}',
};

afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function plugin(
	// A string is written as-is, so a test can ship a file that is not a table.
	locales: Record<string, string | Record<string, string | number>>,
	entry = "import { format, messages } from '@unbound-app/i18n';\nimport { same } from './deep/nested/same';\nexport function start() { return [messages.TITLE, format('BODY', { name: 'x' }), same()]; }",
) {
	const root = await mkdtemp(join(tmpdir(), 'rollup-locales-'));

	roots.push(root);
	await mkdir(join(root, 'src'));
	await mkdir(join(root, 'i18n'));
	await writeFile(join(root, 'manifest.json'), '{"id":"locales.test","main":"index.tsx"}');
	await writeFile(join(root, 'src', 'index.ts'), entry);
	await mkdir(join(root, 'src', 'deep', 'nested'), { recursive: true });
	await writeFile(
		join(root, 'src', 'deep', 'nested', 'same.ts'),
		"import { messages } from '@unbound-app/i18n';\nimport { messages as again } from '@unbound-app/i18n';\nexport const same = () => messages === again;",
	);

	for (const [code, table] of Object.entries(locales)) {
		await writeFile(
			join(root, 'i18n', `${code}.json`),
			typeof table === 'string' ? table : JSON.stringify(table),
		);
	}

	return root;
}

async function build(root: string): Promise<Built> {
	const warnings: string[] = [];
	const { output: outputOptions, ...config } = unbound(
		pathToFileURL(join(root, 'rollup.config.mjs')).href,
		{
			bytecode: false,
		},
	);
	const bundle = await rollup({
		...config,
		onwarn: (warning: RollupLog) => void warnings.push(warning.message),
	});
	const { output } = await bundle.generate(
		Array.isArray(outputOptions) ? {} : (outputOptions ?? {}),
	);

	await bundle.close();

	const assets = new Map(
		output
			.filter((file): file is OutputAsset => file.type === 'asset')
			.map((file) => [file.fileName, String(file.source)]),
	);

	return { code: output[0].code, assets, warnings };
}

async function buildError(root: string): Promise<string> {
	try {
		await build(root);

		return 'built';
	} catch (error) {
		return (error as Error).message;
	}
}

describe('locale build', () => {
	test('inlines en-US, emits the other locales and lists their digests in the manifest', async () => {
		const root = await plugin({
			'en-US': enUS,
			de: { TITLE: 'Willkommen zurück' },
			fr: { TITLE: 'Bon retour' },
		});
		const { code, assets } = await build(root);
		const manifest = JSON.parse(assets.get('manifest.json') ?? '{}');
		const de = assets.get('i18n/de.json') ?? '';

		expect([...assets.keys()].toSorted()).toEqual([
			'i18n/de.json',
			'i18n/fr.json',
			'manifest.json',
		]);
		expect(JSON.parse(de)).toEqual({ TITLE: 'Willkommen zurück' });
		expect(manifest.locales).toEqual({
			de: createHash('sha256').update(de).digest('hex'),
			fr: createHash('sha256')
				.update(assets.get('i18n/fr.json') ?? '')
				.digest('hex'),
		});
		// Every import of the bare specifier shares one module, so en-US is inlined once.
		expect(code.split('Welcome back').length - 1).toBe(1);
		expect(code).not.toContain('Willkommen');

		const fallbacks: unknown[] = [];
		const unbound = {
			i18n: {
				createLocales(fallback: Record<string, string>) {
					fallbacks.push(fallback);

					return {
						messages: fallback,
						format: (key: string) => `formatted ${key}`,
						useMessages: () => fallback,
					};
				},
			},
		};
		const instance = runInNewContext(`(${code})`, {
			unbound,
			React: {},
			ReactNative: {},
		}).__load();

		expect(instance.start()).toEqual(['Welcome back', 'formatted BODY', true]);
		expect(fallbacks).toEqual([enUS]);
	});

	test('ships nothing of the `ubd i18n fix` sidecar and does not warn about it', async () => {
		const root = await plugin({ 'en-US': enUS, de: { TITLE: 'Willkommen zurück' } });

		await writeFile(
			join(root, 'i18n', 'untranslated.jsonc'),
			'// still English\n{ "de": ["BODY"] }\n',
		);

		const { assets, warnings } = await build(root);

		expect([...assets.keys()].toSorted()).toEqual(['i18n/de.json', 'manifest.json']);
		expect(Object.keys(JSON.parse(assets.get('manifest.json') ?? '{}').locales)).toEqual([
			'de',
		]);
		expect(warnings).toEqual([]);
	});

	test('refuses a locale file imported by path and names the module import instead', async () => {
		const root = await plugin(
			{ 'en-US': enUS, de: { TITLE: 'Willkommen zurück' } },
			"import de from '../i18n/de.json';\nexport function start() { return de.TITLE; }",
		);

		expect(await buildError(root)).toContain(
			"src/index.ts  imports ../i18n/de.json by path, which would bundle its languages.  Fix: import from '@unbound-app/i18n' instead",
		);
	});

	test('refuses the locale folder imported by a relative or ~/ path', async () => {
		for (const specifier of ['../i18n', '~/../i18n']) {
			const root = await plugin(
				{ 'en-US': enUS },
				`import { messages } from '${specifier}';\nexport function start() { return messages.TITLE; }`,
			);

			expect(await buildError(root)).toContain(
				`src/index.ts  imports ${specifier} by path, which would bundle its languages.  Fix: import from '@unbound-app/i18n' instead`,
			);
		}
	});

	test('fails clearly when a plugin with no locales imports the module', async () => {
		const root = await plugin({});

		expect(await buildError(root)).toContain(
			'src/index.ts  imports @unbound-app/i18n, but the plugin has no i18n/en-US.json.',
		);
	});

	test('warns on keys en-US lacks and on placeholders that differ, and drops the unknown keys', async () => {
		const root = await plugin({ 'en-US': enUS, de: { BODY: 'Hallo, {nom}!', EXTRA: 'x' } });
		const { assets, warnings } = await build(root);

		expect(JSON.parse(assets.get('i18n/de.json') ?? '{}')).toEqual({ BODY: 'Hallo, {nom}!' });
		expect(warnings).toEqual([
			'[plugin unbound-locales] i18n/de.json  BODY  has placeholders {nom}, but en-US.json has {name}.  Fix: use the placeholders en-US.json uses.',
			'[plugin unbound-locales] i18n/de.json  EXTRA  is not in en-US.json, so it is left out.  Fix: add it to en-US.json, or remove it (ubd i18n fix --prune).',
		]);
	});

	test('fails on a file that is not a JSON object', async () => {
		const root = await plugin({ 'en-US': enUS, de: '["Hallo"]' });

		expect(await buildError(root)).toContain('must be a JSON object');
	});

	test('fails on a value that is not a string', async () => {
		const root = await plugin({ 'en-US': { ...enUS, COUNT: 3 } });

		expect(await buildError(root)).toContain('COUNT must be a string, not number');
	});

	test('fails when translations have no en-US', async () => {
		const root = await plugin({ de: { TITLE: 'Hallo' } });

		expect(await buildError(root)).toContain('no en-US.json');
	});

	test('writes ambient typings whose format takes each key placeholders', async () => {
		const root = await plugin({ 'en-US': enUS });

		await build(root);

		const typingsPath = join(root, 'src', 'unbound-i18n.d.ts');
		const typings = await readFile(typingsPath, 'utf8');

		expect(typings).toContain("declare module '@unbound-app/i18n' {");
		expect(typings).toContain('readonly TITLE: string;');
		expect(typings).toContain('BODY: { name: string | number };');
		expect(typings).toContain('COUNT: { count: number };');
		expect(typings).toContain("PRONOUN: { who: 'he' | 'she' };");
		expect(typings).toContain('WHEN: { at: Date | number };');

		const usage = join(root, 'src', 'deep', 'usage.ts');

		await writeFile(
			usage,
			[
				"import { format, messages, useMessages } from '@unbound-app/i18n';",
				'const a: string = messages.TITLE + useMessages();',
				"format('TITLE');",
				"format('COUNT', { count: 2 });",
				"format('PRONOUN', { who: 'she' });",
				'// @ts-expect-error a key with placeholders needs them',
				"format('BODY');",
				'// @ts-expect-error plural takes a number',
				"format('COUNT', { count: 'two' });",
				'// @ts-expect-error an unknown key',
				'messages.MISSING;',
				'export { a };',
			].join('\n'),
		);

		// A plugin tsconfig includes all of src/, the generated declaration with it.
		await writeFile(
			join(root, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: {
					strict: true,
					noEmit: true,
					module: 'esnext',
					moduleResolution: 'bundler',
					target: 'esnext',
					types: [],
				},
				files: [usage, typingsPath],
			}),
		);

		expect(await runTsc(['-p', 'tsconfig.json'], root)).toEqual({
			diagnostics: [],
			failure: void 0,
		});
	});
});

describe('ICU arguments', () => {
	test('reads nested and quoted arguments', () => {
		const found = readIcuArguments(
			"{n, plural, one {'{literal}' {who}} other {# {who, select, a {x} other {y}}}}",
		);

		expect(Object.fromEntries(found)).toEqual({
			n: { kind: 'number' },
			who: { kind: 'select', options: ['a'], other: true },
		});
	});

	test('throws on an unclosed argument', () => {
		expect(() => readIcuArguments('Hello {name')).toThrow();
	});
});
