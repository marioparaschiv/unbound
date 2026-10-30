import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

test('flags files over the byte budget', async () => {
	const findings = await lintFixture(
		'max-file-bytes',
		{
			'small.ts': 'export const a = 1;',
			'large.ts': `export const a = '${'x'.repeat(2000)}';`,
		},
		{ max: 1024 },
	);

	expect(flaggedFiles(findings)).toEqual(['large.ts']);
	expect(findings[0]?.message).toContain('This file is 2.0 KB');
});

test('defaults to a 20 KB budget', async () => {
	const findings = await lintFixture('max-file-bytes', {
		'under.ts': `export const a = '${'x'.repeat(20_000)}';`,
		'over.ts': `export const a = '${'x'.repeat(21_000)}';`,
	});

	expect(flaggedFiles(findings)).toEqual(['over.ts']);
});
