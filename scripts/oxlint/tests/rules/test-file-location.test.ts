import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '~/lint-fixture';

const code = 'export const a = 1;';

test('flags test files outside their package tests folder', async () => {
	const findings = await lintFixture('test-file-location', {
		'package.json': '{}',
		'packages/gen/package.json': '{}',
		'packages/gen/src/lib/a.ts': code,
		'packages/gen/src/lib/a.test.ts': code,
		'packages/gen/src/lib/b.spec.tsx': code,
		'packages/gen/lib/c.s3.ts': code,
		'packages/gen/d.suite.ts': code,
		'packages/gen/tests/lib/a.test.ts': code,
		'packages/gen/tests/lib/upload.s3.ts': code,
	});

	expect(flaggedFiles(findings)).toEqual([
		'packages/gen/d.suite.ts',
		'packages/gen/lib/c.s3.ts',
		'packages/gen/src/lib/a.test.ts',
		'packages/gen/src/lib/b.spec.tsx',
	]);
	expect(
		findings.find(({ file }) => file === 'packages/gen/src/lib/a.test.ts')?.message,
	).toContain('Move this file to `tests/lib/a.test.ts`');
	expect(findings.every(({ message }) => message.endsWith('(AGENTS.md)'))).toBe(true);
});

test('flags tests folders that mirror no source folder', async () => {
	const findings = await lintFixture('test-file-location', {
		'package.json': '{}',
		'packages/gen/package.json': '{}',
		'packages/gen/src/lib/deep/a.ts': code,
		'packages/gen/build/b.ts': code,
		'packages/gen/tests/wide.test.ts': code,
		'packages/gen/tests/lib/deep/a.test.ts': code,
		'packages/gen/tests/build/b.test.ts': code,
		'packages/gen/tests/helpers/any/where.ts': code,
		'packages/gen/tests/fixtures/any/where.test.ts': code,
		'packages/gen/tests/missing/a.test.ts': code,
		'packages/gen/tests/lib/gone/a.test.ts': code,
	});

	expect(flaggedFiles(findings)).toEqual([
		'packages/gen/tests/lib/gone/a.test.ts',
		'packages/gen/tests/missing/a.test.ts',
	]);
	expect(findings[0]?.message).toContain('mirrors no source folder');
});

test('treats the workspace scripts folder and nested packages as their own roots', async () => {
	const findings = await lintFixture('test-file-location', {
		'package.json': '{ "workspaces": ["packages/*"] }',
		'packages/client/package.json': '{}',
		'packages/client/scripts/a.ts': code,
		'packages/client/tests/scripts/a.test.ts': code,
		'scripts/typecheck.ts': code,
		'scripts/tests/typecheck.test.ts': code,
		'scripts/misplaced.test.ts': code,
		'scripts/tool/package.json': '{}',
		'scripts/tool/rules/a.ts': code,
		'scripts/tool/tests/rules/a.test.ts': code,
		'packages/cli/package.json': '{}',
		'packages/cli/templates/plugin/src/index.test.ts': code,
	});

	expect(flaggedFiles(findings)).toEqual(['scripts/misplaced.test.ts']);
	expect(findings[0]?.message).toContain('Move this file to `tests/misplaced.test.ts`');
});
