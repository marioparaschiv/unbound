import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

test('flags a boolean discriminant beside optional payload fields', async () => {
	const findings = await lintFixture('prefer-discriminated-union', {
		'valid/union.ts':
			'type Result = { ok: true; value: string } | { ok: false; error: string };',
		'valid/no-optional.ts': 'type Result = { ok: boolean; value: string };',
		'valid/other-flag.ts': 'type Row = { visible: boolean; label?: string };',
		'valid/optional-flag.ts': 'type Row = { ok?: boolean; label?: string; hint?: string };',
		'valid/one-optional.ts': 'type Output = { ok: boolean; text: string; data?: number };',
		'invalid/result.ts': 'type Result = { ok: boolean; value?: string; error?: string };',
		'invalid/status.ts':
			'type Status = { connected: boolean; device?: string; error?: string };',
	});

	expect(flaggedFiles(findings)).toEqual(['invalid/result.ts', 'invalid/status.ts']);
	expect(findings.find((finding) => finding.file === 'invalid/result.ts')?.message).toContain(
		'`ok: boolean` beside the optional fields `value`, `error`',
	);
});
