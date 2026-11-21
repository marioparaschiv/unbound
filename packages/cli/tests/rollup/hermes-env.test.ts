import { describe, expect, test } from 'bun:test';
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
});
