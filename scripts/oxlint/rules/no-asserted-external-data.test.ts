import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

test('flags a type asserted onto JSON.parse or response.json output', async () => {
	const findings = await lintFixture('no-asserted-external-data', {
		'valid/schema.ts': 'const value = schema.parse(JSON.parse(text));',
		'valid/unknown.ts': 'const value: unknown = JSON.parse(text);',
		'valid/bare.ts': 'const value = JSON.parse(text);',
		'valid/response.ts': 'async function f() { return schema.parse(await response.json()); }',
		'valid/other-parse.ts': 'const value = other.parse(text) as Thing;',
		'valid/return-unknown.ts':
			'function read(text: string): unknown { return JSON.parse(text); }',
		'valid/return-promise-unknown.ts':
			'async function read(): Promise<unknown> { return response.json(); }',
		'valid/return-untyped.ts': 'function read(text: string) { return JSON.parse(text); }',
		'invalid/return-typed.ts':
			'function read(text: string): Thing { return JSON.parse(text); }',
		'invalid/arrow-typed.ts': 'const read = async (): Promise<Thing> => response.json();',
		'invalid/type-argument.ts':
			'async function f() { return schema.parse(await response.json<Thing>()); }',
		'tests/fixture.ts': 'const value = JSON.parse(text) as Thing;',
		'invalid/as.ts': 'const value = JSON.parse(text) as Thing;',
		'invalid/annotated.ts': 'const value: Thing = JSON.parse(text);',
		'invalid/response-as.ts': 'async function f() { return (await response.json()) as Thing; }',
		'invalid/response-annotated.ts':
			'async function f() { const thing: Thing = await response.json(); }',
	});

	expect(flaggedFiles(findings)).toEqual([
		'invalid/annotated.ts',
		'invalid/arrow-typed.ts',
		'invalid/as.ts',
		'invalid/response-annotated.ts',
		'invalid/response-as.ts',
		'invalid/return-typed.ts',
		'invalid/type-argument.ts',
	]);
	expect(
		findings.find((finding) => finding.file === 'invalid/response-as.ts')?.message,
	).toContain('`.json()` returns unvalidated data');
});
