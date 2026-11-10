import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, test } from 'bun:test';
import type { Plugin, RollupLog } from 'rollup';
import { parseSync } from 'rolldown/utils';
import { pathToFileURL } from 'node:url';
import { swc } from 'rollup-plugin-swc3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';

import { injectLocaleHooks, localeHooks } from '~/rollup/locale-hooks';
import { unboundGlobals } from '~/rollup/globals';
import { pluginConfig } from '~/rollup/preset';

const IMPORT = "import { format, messages } from '@unbound-app/i18n';\n";

function inject(body: string, header = IMPORT) {
	const code = `${header}${body}`;
	const { program } = parseSync('component.tsx', code, { lang: 'tsx' });
	const result = injectLocaleHooks(code, program);

	return { ...result, code: result.output?.toString() ?? code };
}

function injectedNames(body: string, header?: string): string[] {
	return inject(body, header).injected.map(({ name }) => name);
}

const roots: string[] = [];

afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('injecting useMessages()', () => {
	test('into a function declaration, as its first statement, and adds the import', () => {
		const { code, injected } = inject(
			"export function Greeting() {\n\treturn format('GREETING_BODY', { name: 'x' });\n}\n",
		);

		expect(injected.map(({ name }) => name)).toEqual(['Greeting']);
		expect(code).toContain(
			"import { format, messages, useMessages } from '@unbound-app/i18n';",
		);
		expect(code).toContain('export function Greeting() {useMessages();\n\treturn format(');
	});

	test('into a const arrow, turning an expression body into a block', () => {
		const { code } = inject('const Title = () => <Text>{messages.TITLE}</Text>;\n');

		expect(code).toContain(
			'const Title = () => { useMessages(); return <Text>{messages.TITLE}</Text>; };',
		);
	});

	test('into memo- and forwardRef-wrapped components', () => {
		expect(
			injectedNames(
				[
					'const A = memo(() => messages.A);',
					'const B = React.memo(function () { return messages.B; });',
					'const C = forwardRef((props, ref) => messages.C);',
					'const D = React.forwardRef(function (props, ref) { return messages.D; });',
				].join('\n'),
			),
		).toEqual(['memo(A)', 'memo(B)', 'forwardRef(C)', 'forwardRef(D)']);
	});

	test('into a use* hook', () => {
		expect(injectedNames('function useTitle() { return messages.TITLE; }\n')).toEqual([
			'useTitle',
		]);
	});

	test('at the top of a component that reads strings only inside an onPress callback', () => {
		const { code, injected } = inject(
			'const Save = () => <Button onPress={() => alert(messages.SAVED)} />;\n',
		);

		expect(injected.map(({ name }) => name)).toEqual(['Save']);
		expect(code).toContain(
			'const Save = () => { useMessages(); return <Button onPress={() => alert(messages.SAVED)} />; };',
		);
	});

	test('into a component that calls a same-file helper, followed transitively', () => {
		expect(
			injectedNames(
				[
					"function label() { return messages['TITLE']; }",
					'const prefixed = () => `» ${label()}`;',
					'function Header() { return <Text>{prefixed()}</Text>; }',
				].join('\n'),
			),
		).toEqual(['Header']);
	});

	test('after a directive prologue, which must stay first', () => {
		const { code } = inject("function Title() { 'use strict'; return messages.TITLE; }\n");

		expect(code).toContain(
			"function Title() { 'use strict';useMessages(); return messages.TITLE; }",
		);
	});

	test('through a renamed import, and under a free name when useMessages is taken', () => {
		const { code, injected } = inject(
			'const useMessages = 1;\nconst Title = () => strings.TITLE;\n',
			"import { messages as strings } from '@unbound-app/i18n';\n",
		);

		expect(injected.map(({ name }) => name)).toEqual(['Title']);
		expect(code).toContain(
			"import { messages as strings, useMessages as useMessages2 } from '@unbound-app/i18n';",
		);
		expect(code).toContain('const Title = () => { useMessages2(); return strings.TITLE; };');
	});

	test('reuses a renamed useMessages import instead of adding another', () => {
		const { code } = inject(
			'const Title = () => messages.TITLE;\n',
			"import { messages, useMessages as useStrings } from '@unbound-app/i18n';\n",
		);

		expect(code).toContain('const Title = () => { useStrings(); return messages.TITLE; };');
	});
});

describe('leaving code alone', () => {
	test('when the component already calls useMessages()', () => {
		expect(
			injectedNames(
				'function Title() { useStrings(); return messages.TITLE; }\n',
				"import { messages, useMessages as useStrings } from '@unbound-app/i18n';\n",
			),
		).toEqual([]);
	});

	test('in a plain helper nothing renders', () => {
		expect(injectedNames("function label() { return format('TITLE'); }\n")).toEqual([]);
	});

	test('when a local binding shadows the import', () => {
		expect(
			injectedNames(
				'function Title() { const messages = { TITLE: 1 }; return messages.TITLE; }\n',
			),
		).toEqual([]);
	});

	test('in a file that does not import @unbound-app/i18n', () => {
		expect(
			injectedNames(
				'function Title() { return messages.TITLE; }\n',
				"import { messages } from '~/strings';\n",
			),
		).toEqual([]);
	});

	test('in a class component, which is reported instead', () => {
		const { injected, classReaders } = inject(
			'class Title extends Component { render() { return messages.TITLE; } }\n',
		);

		expect(injected).toEqual([]);
		expect(classReaders.map(({ name }) => name)).toEqual(['Title']);
	});
});

async function plugin(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'locale-hooks-'));

	roots.push(root);
	await mkdir(join(root, 'src'));
	await mkdir(join(root, 'i18n'));
	await writeFile(join(root, 'i18n', 'en-US.json'), '{"TITLE":"Hi"}');
	await writeFile(join(root, 'manifest.json'), '{"id":"hooks.test","main":"index.tsx"}');

	for (const [name, source] of Object.entries(files))
		await writeFile(join(root, 'src', name), source);

	return root;
}

describe('the rollup pass', () => {
	test('warns on a class component with its file and line', async () => {
		const root = await plugin({
			'index.tsx': `${IMPORT}\nexport class Title extends Component {\n\trender() { return messages.TITLE; }\n}\n`,
		});
		const warnings: string[] = [];
		const bundle = await rollup({
			input: join(root, 'src', 'index.tsx'),
			external: () => true,
			plugins: [localeHooks(root), swc({ tsconfig: false })],
			onwarn: (warning: RollupLog) => void warnings.push(warning.message),
		});

		await bundle.close();

		expect(warnings).toEqual([
			expect.stringContaining(
				'src/index.tsx:3 Title reads messages or format from @unbound-app/i18n, but a class component cannot call useMessages()',
			),
		]);
	});

	test('runs before swc in the preset, so the refresh signature includes the added hook', async () => {
		const root = await plugin({
			'index.tsx': `${IMPORT}export function Title() { return <Text>{messages.TITLE}</Text>; }\n`,
		});
		const config = pluginConfig(
			pathToFileURL(join(root, 'rollup.config.mjs')).href,
			unboundGlobals,
			{
				bytecode: false,
			},
		);
		const names = (config.plugins as Plugin[]).map((entry) => entry.name);

		expect(names.indexOf('unbound-locale-hooks')).toBeLessThan(names.indexOf('swc'));

		const bundle = await rollup({
			input: join(root, 'src', 'index.tsx'),
			external: () => true,
			plugins: [
				localeHooks(root),
				swc({
					tsconfig: false,
					jsc: {
						transform: {
							react: { refresh: { emitFullSignatures: true }, development: true },
						},
					},
				}),
			],
		});
		const { output } = await bundle.generate({ format: 'es' });

		await bundle.close();

		const [chunk] = output;

		// swc keys the signature by the hook calls it found, so the injected call must already be in the source.
		expect(chunk.code).toContain('useMessages()');
		expect(chunk.code).toContain('_s(Title, "useMessages{}"');
	});
});
