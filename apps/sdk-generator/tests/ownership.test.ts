import { mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ModuleEntry } from '../src/paths';

import { buildOwnership } from '../src/ownership';

function moduleEntry(source: string): ModuleEntry {
	return { name: 'sample', source, out: '/api/src/sample.d.ts', topLevel: true };
}

describe('buildOwnership', () => {
	test('attributes named and default imports from a types subpath', () => {
		const dir = mkdtempSync(join(tmpdir(), 'sdk-ownership-'));
		const source = join(dir, 'sample.ts');

		writeFileSync(
			source,
			[
				"import type SampleDefault from '@unbound-app/types/sample';",
				"import type { SampleNamed } from '@unbound-app/types/sample';",
				"import type { SharedUtil } from '@unbound-app/types/utils';",
				"import type { BarrelType } from '@unbound-app/types';",
				'export type All = SampleDefault | SampleNamed | SharedUtil | BarrelType;',
			].join('\n'),
		);

		const owned = buildOwnership([moduleEntry(source)]);

		expect(owned.get('/api/src/sample.d.ts')).toEqual(
			new Set(['SampleDefault', 'SampleNamed']),
		);
	});
});
