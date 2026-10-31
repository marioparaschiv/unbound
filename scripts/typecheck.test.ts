import { describe, expect, test } from 'bun:test';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { PROJECTS, summarize, typeErrors } from './typecheck';

const root = resolve(import.meta.dir, '..');

describe('typecheck', () => {
	test('picks only error lines out of tsc output', () => {
		const output =
			'src/a.ts(1,2): error TS2322: Type mismatch.\n  Details\nsrc/b.ts(3,4): error TS2345: Bad argument.';

		expect(typeErrors(output)).toEqual([
			'src/a.ts(1,2): error TS2322: Type mismatch.',
			'src/b.ts(3,4): error TS2345: Bad argument.',
		]);
	});

	test('names each failing project and counts them', () => {
		const { lines, ok } = summarize([
			{ project: 'packages/a', errors: ['x.ts(1,1): error TS1: bad'] },
			{ project: 'packages/b', errors: [] },
		]);

		expect(ok).toBe(false);
		expect(lines).toEqual([
			'packages/a/x.ts(1,1): error TS1: bad',
			'1 of 2 projects have type errors.',
		]);
	});

	test('reports a clean run', () => {
		expect(summarize([{ project: 'packages/a', errors: [] }])).toEqual({
			lines: ['All 1 projects type-check.'],
			ok: true,
		});
	});

	test('covers every project with a tsconfig', () => {
		for (const project of PROJECTS)
			expect(existsSync(join(root, project, 'tsconfig.json'))).toBe(true);
	});
});
