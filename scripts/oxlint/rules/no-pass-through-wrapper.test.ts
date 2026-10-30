import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '../lint-fixture';

const IMPORT = "import { get } from './store';\n";

test('flags only functions that forward every argument into an imported module', async () => {
	const findings = await lintFixture('no-pass-through-wrapper', {
		'valid/adds-work.ts': `${IMPORT}export function read(id: string) { return get(id).value; }`,
		'valid/adds-argument.ts': `${IMPORT}export function read(id: string) { return get(id, true); }`,
		'valid/reorders.ts': `${IMPORT}export function read(a: string, b: string) { return get(b, a); }`,
		'valid/no-params.ts': `${IMPORT}export function read() { return get(); }`,
		'valid/local-lookup.ts':
			"const ICONS = new Set(['a']);\nexport function isIcon(name: string) { return ICONS.has(name); }",
		'valid/nested-state.ts':
			"import { data } from './data';\nexport function off(listener: () => void) { data.listeners.delete(listener); }",
		'valid/predicate.ts': `${IMPORT}export function isName(value: string): value is 'a' { return get(value); }`,
		'valid/override.ts': `${IMPORT}class Listener extends Base { run(event: string) { return get(event); } }`,
		'tests/helper.ts': `${IMPORT}export function read(id: string) { return get(id); }`,
		'invalid/declaration.ts': `${IMPORT}export function read(id: string) { return get(id); }`,
		'invalid/arrow.ts':
			"import terminal from 'terminal-kit';\nconst rgb = (hex: string, text: string) => terminal.colorRgbHex(hex, text);",
		'invalid/rest.ts':
			"import * as store from './store';\nexport async function read(...ids: string[]) { await store.get(...ids); }",
		'invalid/method.ts': `${IMPORT}class Reader { read(id: string) { return get(id); } }`,
	});

	expect(flaggedFiles(findings)).toEqual([
		'invalid/arrow.ts',
		'invalid/declaration.ts',
		'invalid/method.ts',
		'invalid/rest.ts',
	]);
	expect(
		findings.find((finding) => finding.file === 'invalid/declaration.ts')?.message,
	).toContain('`read` only forwards its arguments to `get`');
});
