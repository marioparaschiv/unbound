import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { apply, check, type Table } from './index';

const TABLE: Table = {
	moves: {
		'entry.ts': 'core/entry.ts',
		'index.ts': 'core/index.ts',
		'api/storage.ts': 'storage/api.ts',
		'api/metro/': 'metro/',
	},
	removals: ['ui/index.ts', 'lib/force-render.ts'],
};

const FILES: Record<string, string> = {
	'packages/client/src/entry.ts': "require('./index');\nrequire('.');\n",
	'packages/client/src/index.ts': "import '~/api/metro';\nimport storage from '~/api/storage';\n",
	'packages/client/src/api/storage.ts': 'export function get() {}\n\nexport default { get };\n',
	'packages/client/src/api/metro/index.ts': "export * from './search';\n",
	'packages/client/src/api/metro/search.ts': 'export const find = 1;\n',
	'packages/client/src/ui/page.tsx':
		"import { find } from '~/api/metro';\nimport { get } from '../api/storage';\n",
	'packages/client/src/ui/index.ts': "export * from './page';\n",
	'packages/client/tests/storage.test.ts':
		"mock.module('~/api/storage', () => ({}));\nawait import('~/api/metro/search');\n",
	'packages/client/scripts/build.ts':
		"const input = 'src/entry.ts';\nconst hot = /\\/src\\/api\\/metro\\//;\n",
	'apps/tool/config.ts': "export const files = ['packages/client/src/api/metro/**'];\n",
};

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'unbound-domain-move-'));

	for (const [path, text] of Object.entries(FILES)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}

	Bun.spawnSync(['git', 'init', '-q'], { cwd: root });
	Bun.spawnSync(['git', 'add', '-A'], { cwd: root });

	return root;
}

function read(root: string, path: string): string {
	return readFileSync(join(root, path), 'utf8');
}

describe('domain move', () => {
	test('check lists every unmoved file and stale specifier before the move', () => {
		const leftovers = check(fixture(), TABLE);

		expect(leftovers).toContain(
			'unmoved packages/client/src/api/storage.ts -> packages/client/src/storage/api.ts',
		);
		expect(leftovers).toContain(
			'stale packages/client/src/ui/page.tsx: ../api/storage -> ~/storage/api',
		);
	});

	test('moves every row, rewrites every reference and leaves stubs that check accepts', () => {
		const root = fixture();
		const summary = apply(root, TABLE, { stubs: true });

		expect(summary).toMatchObject({ moved: 5, stubs: 5, deleted: 0 });
		expect(check(root, TABLE)).toEqual([]);
		expect(read(root, 'packages/client/src/core/entry.ts')).toBe(
			"require('./index');\nrequire('.');\n",
		);
		expect(read(root, 'packages/client/src/core/index.ts')).toBe(
			"import '~/metro';\nimport storage from '~/storage/api';\n",
		);
		expect(read(root, 'packages/client/src/ui/page.tsx')).toBe(
			"import { find } from '~/metro';\nimport { get } from '~/storage/api';\n",
		);
		expect(read(root, 'packages/client/tests/storage.test.ts')).toBe(
			"mock.module('~/storage/api', () => ({}));\nawait import('~/metro/search');\n",
		);
		expect(read(root, 'packages/client/scripts/build.ts')).toBe(
			"const input = 'src/core/entry.ts';\nconst hot = /\\/src\\/metro\\//;\n",
		);
		expect(read(root, 'apps/tool/config.ts')).toContain("'packages/client/src/metro/**'");
		expect(read(root, 'packages/client/src/api/storage.ts')).toBe(
			"export { default } from '~/storage/api';\nexport * from '~/storage/api';\n",
		);
		expect(read(root, 'packages/client/src/entry.ts')).toBe("import '~/core/entry';\n");
		expect(existsSync(join(root, 'packages/client/src/ui/index.ts'))).toBe(true);
	});

	test('a second run changes nothing', () => {
		const root = fixture();

		apply(root, TABLE, { stubs: true });

		expect(apply(root, TABLE, { stubs: true })).toMatchObject({ moved: 0, rewritten: 0 });
	});

	test('runs only the selected rows', () => {
		const root = fixture();

		apply(root, TABLE, { only: ['api/storage.ts'] });

		expect(existsSync(join(root, 'packages/client/src/storage/api.ts'))).toBe(true);
		expect(existsSync(join(root, 'packages/client/src/api/metro/index.ts'))).toBe(true);
		expect(read(root, 'packages/client/src/ui/page.tsx')).toBe(
			"import { find } from '~/api/metro';\nimport { get } from '~/storage/api';\n",
		);
	});

	test('contract mode deletes the stubs and removals that expand mode keeps', () => {
		const root = fixture();

		apply(root, TABLE, { stubs: true });

		expect(check(root, TABLE, { contract: true })).toContain(
			'not removed packages/client/src/ui/index.ts',
		);
		expect(apply(root, TABLE, { contract: true }).deleted).toBe(6);
		expect(existsSync(join(root, 'packages/client/src/ui/index.ts'))).toBe(false);
		expect(existsSync(join(root, 'packages/client/src/api'))).toBe(false);
		expect(check(root, TABLE, { contract: true })).toEqual([]);
	});

	test('contract mode changes nothing while a file still imports a removal', () => {
		const root = fixture();
		const page = 'packages/client/src/ui/settings.tsx';

		writeFileSync(join(root, page), "import { find } from '~/ui';\n");

		expect(() => apply(root, TABLE, { contract: true })).toThrow(
			`${page} imports ~/ui, which contract mode deletes`,
		);
		expect(existsSync(join(root, 'packages/client/src/api/storage.ts'))).toBe(true);
		expect(existsSync(join(root, 'packages/client/src/ui/index.ts'))).toBe(true);
	});
});
