import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { emitModuleIndex, MAX_TARGETS, MODULE_INDEX_FILE, moduleKey } from '~/emit-modules';
import type { ComponentRecord, ModuleRecord } from '~/types';
import { objectKeys, shapeOf } from '~/module-shapes';
import type { ModuleShape } from '~/module-shapes';
import { runPipeline } from '~/pipeline';
import { loadHostProps } from '~/hosts';
import { splitModules } from '~/split';
import { TYPES_DIR } from '~/paths';

// Three small modules in hermes-dec's layout: an object default export, named exports, and one with no source path.
const lines = readFileSync(join(import.meta.dir, 'fixtures', 'module-index.txt'), 'utf8').split(
	'\n',
);
const modules: ModuleRecord[] = [];

for await (const module of splitModules(lines)) modules.push(module);

const { files } = await runPipeline('fixture', modules, loadHostProps(TYPES_DIR));
const index = (files.get(MODULE_INDEX_FILE) ?? '').replace(/\s+/g, ' ');
const pathless = moduleKey(shapeOf(modules[2]!));

describe('shapeOf', () => {
	test('reads the keys of an object default export, including keys written after the literal', () => {
		expect(shapeOf(modules[0]!)).toEqual({
			id: 900001,
			path: 'actions/FakeActionCreators.tsx',
			exportNames: ['default'],
			defaultKeys: ['sendFake', 'receiveFake', 'editFake'],
		});
	});

	test("ignores a nested function's own exports parameter and a register reused after holding the exports", () => {
		expect(shapeOf(modules[0]!).exportNames).not.toContain('notAnExport');
		expect(shapeOf(modules[1]!).exportNames).toEqual(['formatFake', 'sendFake']);
	});

	test('reads nested object literal keys only at the top level', () => {
		expect(objectKeys("{'a': null, 'b': {'c': 1}, 'd\\'e': [1, {'f': 2}]}")).toEqual([
			'a',
			'b',
			"d'e",
		]);
	});
});

describe('moduleKey', () => {
	test('keys by source path, else by a hash of the export names, never by module id', () => {
		expect(moduleKey(shapeOf(modules[1]!))).toBe('utils/FakeUtils.tsx');
		expect(pathless).toMatch(/^~[0-9a-f]{10}$/);
		expect(moduleKey({ ...shapeOf(modules[2]!), id: 1 })).toBe(pathless);
	});
});

// A module with a component the index can type, and plain modules around it.
function component(name: string): ComponentRecord {
	return {
		name,
		moduleId: 0,
		path: undefined,
		exportNames: [name],
		kind: 'function',
		rendersJsx: true,
		props: new Map(),
		params: new Map(),
		restTargets: [],
		propsEscape: false,
		hookCalls: [],
		statics: [],
		overrides: new Map(),
	};
}

function shape(path: string, exportNames: string[], defaultKeys: string[] = []): ModuleShape {
	return { id: 0, path, exportNames, defaultKeys };
}

function emitWithTyped(shapes: ModuleShape[], typedPath?: string): string {
	const row = component('Row');

	return emitModuleIndex({
		build: 'fixture',
		shapes,
		exports: typedPath ? [{ path: typedPath, exportName: 'Row', component: row }] : [],
		names: new Map([[row, 'Row']]),
		typed: new Set(['RowComponent']),
	});
}

describe('module index', () => {
	test('suggests every name and path of modules with two distinctive names, typing none of them', () => {
		expect(index).toContain(
			"export type DiscordExportName = 'editFake' | 'formatFake' | 'parseFake' | 'receiveFake' | 'sendFake';",
		);
		expect(index).toContain(
			"export type DiscordModulePath = 'actions/FakeActionCreators.tsx' | 'utils/FakeUtils.tsx';",
		);
		expect(index).toContain('export type DiscordModules = { };');
		expect(index).toContain('export type DiscordModuleProps = { };');
	});

	test('emits the shape of a module with a typed export and resolves its props', () => {
		const text = emitWithTyped(
			[shape('a/Rows.tsx', ['Row', 'rowHelper']), shape('a/Plain.tsx', ['plainA', 'plainB'])],
			'a/Rows.tsx',
		);

		expect(text).toContain(
			"\t'a/Rows.tsx': {\n\t\tRow: RowComponent;\n\t\trowHelper: any;\n\t};",
		);
		expect(text).toContain("\tRow: 'a/Rows.tsx';");
		expect(text).not.toContain("'a/Plain.tsx': {");
		expect(text).not.toContain('\tplainA:');
		expect(text).toContain("import type { RowComponent } from './barrels.gen';");
	});

	test('maps a prop more than MAX_TARGETS modules expose to string', () => {
		const shapes = Array.from({ length: MAX_TARGETS + 1 }, (_, id) =>
			shape(`common/Module${id}.tsx`, ['close', `only${id}`, `also${id}`]),
		);

		shapes.push(shape('common/Rows.tsx', ['close', 'Row', 'rowHelper']));

		expect(emitWithTyped(shapes, 'common/Rows.tsx')).toContain('\tclose: string;');
	});

	test('drops a prop a typed module shares with an untyped one, so the lookup stays loose', () => {
		const text = emitWithTyped(
			[
				shape('a/Rows.tsx', ['Row', 'rowHelper', 'shared']),
				shape('a/Other.tsx', ['shared', 'otherA', 'otherB']),
			],
			'a/Rows.tsx',
		);

		expect(text).toContain("\trowHelper: 'a/Rows.tsx';");
		expect(text).not.toContain('\n\tshared: ');
	});

	test('skips a module with fewer than two distinctive names', () => {
		const text = emitWithTyped([
			shape('a/Kept.tsx', ['keptA', 'keptB']),
			shape('a/Skipped.tsx', ['x']),
		]);

		expect(text).toContain("'a/Kept.tsx'");
		expect(text).not.toContain('a/Skipped.tsx');
	});

	test('output is byte-identical across runs', async () => {
		const again = await runPipeline('fixture', modules, loadHostProps(TYPES_DIR));

		expect(again.files.get(MODULE_INDEX_FILE)).toBe(files.get(MODULE_INDEX_FILE));
	});
});
