import { describe, expect, test } from 'bun:test';

import { buildPlugin, clientFilters, customKeys, runFilters } from './helpers/filter-plugin';

const api = "import { metro } from '@unbound-app/api';\n";

// Each predicate here is beyond the built-ins, so it keeps a key of its own source.
const routes = 'export const start = () => [metro.find((m) => Object.keys(m).length === 2)];';

async function keysOf(files: Record<string, string>) {
	return customKeys((await buildPlugin(files)).code);
}

describe('filter keys', () => {
	test('gives equal predicates in two plugin builds the same key', async () => {
		const [first] = await keysOf({ 'index.ts': api + routes });
		const [second] = await keysOf({
			'index.ts': `${api}const unrelated = 1;\nexport const other = () => unrelated;\n${routes}`,
		});

		expect(first).toMatch(/^custom::[0-9a-f]{16}$/);
		expect(second).toBe(first);
	});

	test('gives equal predicates in two files of one plugin the same key', async () => {
		const keys = await keysOf({
			'index.ts': `${api}import { byPair } from './pair';\nexport const start = () => [metro.find((m) => Object.keys(m).length === 2), metro.find(byPair)];`,
			'pair.ts': 'export const byPair = (mod: any) => Object.keys(mod).length === 2;',
		});

		expect(keys).toHaveLength(2);
		expect(new Set(keys).size).toBe(1);
	});

	test('ignores parameter names, quotes, comments and whitespace', async () => {
		const [plain] = await keysOf({
			'index.ts': `${api}export const start = () => [metro.find((m) => m.kind === 'row' && m.size > 2)];`,
		});
		const [styled] = await keysOf({
			'index.ts': `${api}export const start = () => [metro.find((module) => /* a row */ module.kind === "row"\n\t&& (module.size > 2))];`,
		});

		expect(styled).toBe(plain);
	});

	test('gives different bodies different keys', async () => {
		const keys = await keysOf({
			'index.ts': `${api}export const start = () => [metro.find((m) => m.kind === 'row'), metro.find((m) => m.kind === 'cell'), metro.find((m) => m.kind !== 'row')];`,
		});

		expect(new Set(keys).size).toBe(3);
	});

	test('keys a factory predicate, leaving its arguments to the runtime key', async () => {
		const { code } = await buildPlugin({
			'index.ts': `${api}const byRoute = metro.filter((m, route: string) => m.route === route);\nexport const start = () => [metro.find(byRoute('SETTINGS'))];`,
		});

		const [settings] = runFilters(code, await clientFilters());

		if (!settings) {
			throw new Error('The bundle returned no filter.');
		}

		expect(settings[Symbol.for('metro.cache')]).toBe(`${customKeys(code)[0]}::["SETTINGS"]`);
		expect(settings({ route: 'SETTINGS' })).toBe(true);
	});

	test('keys a predicate imported from another file', async () => {
		const { code } = await buildPlugin({
			'index.ts': `${api}import { byPair } from './filters/pair';\nexport const start = () => [metro.find(byPair)];`,
			'filters/pair.ts':
				'export function byPair(mod: any) { return Object.keys(mod).length === 2; }',
		});

		expect(customKeys(code)).toHaveLength(1);
	});

	test('keys an alias and a re-export', async () => {
		const keys = await keysOf({
			'index.ts': `${api}import { byPairAgain } from './barrel';\nconst alias = byPairAgain;\nconst again = alias;\nexport const start = () => [metro.find(again), metro.findLazy(byPairAgain)];`,
			'barrel.ts': "export { byPair as byPairAgain } from './pair';",
			'pair.ts': 'export const byPair = (mod: any) => Object.keys(mod).length === 2;',
		});
		const [inline] = await keysOf({ 'index.ts': api + routes });

		expect(keys).toHaveLength(2);
		expect(keys.every((key) => key === inline)).toBe(true);
	});

	test('keys each part of a combination and each bulk item', async () => {
		const keys = await keysOf({
			'index.ts': `${api}export const start = () => [metro.filters.all(metro.filters.byProps('colors'), (m) => typeof m.colors === 'object'), metro.bulk({ filter: (m) => m.size > 2 })];`,
		});

		expect(keys).toHaveLength(2);
	});

	test('fails the build when a predicate reads a captured variable, naming the fix', async () => {
		const build = buildPlugin({
			'index.ts': `${api}const wanted = 'row';\nexport const start = () => [metro.find((m) => m.kind === wanted)];`,
		});

		const error = await build.then(
			() => void 0,
			(failure: Error) => failure,
		);

		expect(error?.message).toContain('Fix: pass `wanted` as an argument');
	});

	test('hashes in a helper function the predicate calls', async () => {
		const helper = (body: string) =>
			`${api}function size(m: any) { return ${body}; }\nexport const start = () => [metro.find((m) => size(m) === 2)];`;
		const [keys] = await keysOf({ 'index.ts': helper('Object.keys(m).length') });
		const [values] = await keysOf({ 'index.ts': helper('Object.values(m).length') });

		expect(keys).toMatch(/^custom::/);
		expect(values).not.toBe(keys);
	});

	test('leaves a parameter-passed predicate unkeyed, warning at the call site', async () => {
		const { code, warnings } = await buildPlugin({
			'index.ts': `${api}export function lookup(predicate: (m: any) => boolean) { return metro.find(predicate); }\nexport const start = () => [lookup((m) => m.size > 2)];`,
		});

		expect(customKeys(code)).toEqual([]);
		expect(warnings).toEqual([
			expect.stringMatching(
				/index\.ts  `metro\.find\(predicate\)` gets a filter passed through a parameter/,
			),
		]);
	});

	test('warns for a predicate chosen conditionally', async () => {
		const { warnings } = await buildPlugin({
			'index.ts': `${api}const flag = Math.random() > 0.5;\nexport const start = () => [metro.find(flag ? (m) => m.a : (m) => m.b)];`,
		});

		expect(warnings).toEqual([expect.stringContaining('chosen conditionally')]);
	});

	test('leaves a built-in filter to its runtime key', async () => {
		const { code, warnings } = await buildPlugin({
			'index.ts': `${api}const byRow = metro.filters.byName('Row');\nexport const start = () => [metro.find(byRow)];`,
		});

		expect(customKeys(code)).toEqual([]);
		expect(warnings).toEqual([]);
	});
});
