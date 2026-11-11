import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { pluginsWithTests } from '~/test-plugins';

test('lists each plugin with a test under tests/ once', () => {
	const dir = mkdtempSync(join(tmpdir(), 'plugins-'));
	const files = [
		'alpha/tests/a.test.tsx',
		'alpha/tests/lib/b.test.ts',
		'beta/tests/c.test.ts',
		'gamma/src/d.test.ts',
		'delta/src/e.ts',
	];

	for (const file of files) {
		mkdirSync(join(dir, file, '..'), { recursive: true });
		writeFileSync(join(dir, file), '');
	}

	expect(pluginsWithTests(dir)).toEqual(['alpha', 'beta']);
});
