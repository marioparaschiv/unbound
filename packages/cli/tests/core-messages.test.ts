import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { CORE_TYPINGS, coreMessageTypings, readCoreSource } from '../src/rollup/core-messages';

describe('core message typings', () => {
	test('match i18n/en-US.json; run `bun packages/cli/src/rollup/core-messages.ts` after editing it', () => {
		expect(readFileSync(CORE_TYPINGS, 'utf8')).toBe(coreMessageTypings(readCoreSource()));
	});

	test('type each placeholder from its ICU argument', () => {
		const typings = coreMessageTypings({
			PLAIN: 'Saved',
			NAMED: 'Starred {name}',
			COUNTED: '{count, plural, one {# item} other {# items}}',
		});

		expect(typings).toContain('NAMED: { name: string | number };');
		expect(typings).toContain('COUNTED: { count: number };');
		expect(typings).not.toContain('PLAIN:');
	});
});
