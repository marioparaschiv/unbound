import { describe, expect, test } from 'bun:test';
import { transformSync } from '@swc/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HERMES_SOURCE_ENV } from '../../src/rollup/hermes-env.ts';

describe('HERMES_SOURCE_ENV', () => {
	test("matches the client's env, which Discord's Hermes already runs from source", () => {
		const swcrc = JSON.parse(
			readFileSync(join(import.meta.dir, '..', '..', '..', 'client', '.swcrc'), 'utf8'),
		);

		expect(HERMES_SOURCE_ENV).toEqual(swcrc.env);
	});

	test('lowers async arrow parameters, whose return value Hermes loses', () => {
		const { code } = transformSync(
			'const a = async ([x]) => x; const b = async ({ y }) => y; const c = async (z = 1) => z; const d = async (...r) => r;',
			{ jsc: { parser: { syntax: 'ecmascript' } }, env: HERMES_SOURCE_ENV },
		);

		expect(code).not.toMatch(/async\s*\(\s*[[{]/);
		expect(code).not.toMatch(/async\s*\([^)]*=/);
		expect(code).not.toMatch(/async\s*\(\s*\.\.\./);
	});
});
