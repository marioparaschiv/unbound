import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { assertOneProducerPerOutput, emittedHoistFiles, sdkVersion } from '~/generate';
import { API_SRC, INTERNAL_OUT } from '~/config';
import type { ModuleEntry } from '~/entry-types';
import type { HoistFile } from '~/bundle';

function moduleEntry(name: string): ModuleEntry {
	return { name, source: '', out: join(API_SRC, `${name}.d.ts`), topLevel: true };
}

function hoistFile(name: string, deps: string[] = []): HoistFile {
	return {
		out: join(API_SRC, `${name}.d.ts`),
		text: '',
		names: new Set<string>(),
		exportedNames: new Set<string>(),
		deps: new Set(deps.map((dep) => join(API_SRC, `${dep}.d.ts`))),
	};
}

describe('assertOneProducerPerOutput', () => {
	test('accepts modules with distinct outputs', () => {
		expect(() =>
			assertOneProducerPerOutput(
				new Map([[join(API_SRC, 'global.d.ts'), 'the globals file']]),
				[moduleEntry('metro'), moduleEntry('toasts')],
			),
		).not.toThrow();
	});

	test('names the module that collides with a reserved file', () => {
		expect(() =>
			assertOneProducerPerOutput(
				new Map([[join(API_SRC, 'global.d.ts'), 'the globals file']]),
				[moduleEntry('global')],
			),
		).toThrow("Module 'global' output");
	});

	test('rejects two modules sharing one output', () => {
		expect(() =>
			assertOneProducerPerOutput(new Map(), [moduleEntry('metro'), moduleEntry('metro')]),
		).toThrow("collides with module 'metro'");
	});
});

describe('emittedHoistFiles', () => {
	test('always keeps _internal and closes over the used files dependencies', () => {
		const files = [
			hoistFile('_internal'),
			hoistFile('_types'),
			hoistFile('tseep', ['possess']),
			hoistFile('possess'),
			hoistFile('unused'),
		];
		const emitted = emittedHoistFiles(files, new Set([join(API_SRC, 'tseep.d.ts')]));

		expect(emitted.map((file) => file.out)).toEqual([
			INTERNAL_OUT,
			join(API_SRC, 'tseep.d.ts'),
			join(API_SRC, 'possess.d.ts'),
		]);
	});
});

describe('sdkVersion', () => {
	test('prefixes the client version and ignores comments and file order', () => {
		const a = sdkVersion(
			'1.0.0',
			new Map([
				['/b.d.ts', 'export declare const b: number;'],
				['/a.d.ts', '/** doc */\nexport declare const a: string;'],
			]),
		);
		const b = sdkVersion(
			'1.0.0',
			new Map([
				['/a.d.ts', 'export declare const a: string;'],
				['/b.d.ts', 'export declare const b: number;'],
			]),
		);

		expect(a).toMatch(/^1\.0\.0-[0-9a-f]{64}$/);
		expect(a).toBe(b);
	});

	test('changes when the surface changes', () => {
		const before = sdkVersion(
			'1.0.0',
			new Map([['/a.d.ts', 'export declare const a: string;']]),
		);
		const after = sdkVersion(
			'1.0.0',
			new Map([['/a.d.ts', 'export declare const a: number;']]),
		);

		expect(before).not.toBe(after);
	});
});
