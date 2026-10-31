import { describe, expect, test } from 'bun:test';

import { rewriteSource, type Layout } from './rewrite';

const SRC = 'packages/client/src';

const layout: Layout = {
	files: new Map([
		[`${SRC}/managers/index.ts`, `${SRC}/addons/managers.ts`],
		[`${SRC}/managers/base.ts`, `${SRC}/addons/manager.ts`],
		[`${SRC}/managers/addons.ts`, `${SRC}/addons/addons.ts`],
		[`${SRC}/api/i18n.ts`, `${SRC}/i18n/api.ts`],
	]),
	directories: new Map(),
	removed: new Set([`${SRC}/managers/utils.ts`]),
	known: new Set([
		`${SRC}/managers/index.ts`,
		`${SRC}/managers/base.ts`,
		`${SRC}/managers/addons.ts`,
		`${SRC}/managers/utils.ts`,
		`${SRC}/api/i18n.ts`,
		`${SRC}/api/index.ts`,
		'i18n/en-US.json',
	]),
};

describe('rewriteSource', () => {
	test('names a moved folder index by its new file', () => {
		const { text } = rewriteSource(
			"import { Plugins } from '~/managers';\n",
			`${SRC}/ui/page.tsx`,
			`${SRC}/ui/page.tsx`,
			layout,
		);

		expect(text).toBe("import { Plugins } from '~/addons/managers';\n");
	});

	test('keeps siblings that move together relative', () => {
		const { text } = rewriteSource(
			"import type { Manager } from './base';\n",
			`${SRC}/managers/addons.ts`,
			`${SRC}/addons/addons.ts`,
			layout,
		);

		expect(text).toBe("import type { Manager } from './manager';\n");
	});

	test('recomputes a relative path out of the package when its importer moves', () => {
		const { text } = rewriteSource(
			"import enUS from '../../../../i18n/en-US.json';\n",
			`${SRC}/api/i18n.ts`,
			`${SRC}/i18n/api.ts`,
			layout,
		);

		expect(text).toBe("import enUS from '../../../../i18n/en-US.json';\n");
	});

	test('reads a path string that names a folder as the folder, not its index', () => {
		const source = "const layer = 'packages/client/src/api';\n";

		expect(rewriteSource(source, '.oxlintrc.json', '.oxlintrc.json', layout).text).toBe(source);
	});

	test('reports a specifier that names a removed file', () => {
		const { changes } = rewriteSource(
			"import { managers } from '~/managers/utils';\n",
			`${SRC}/index.ts`,
			`${SRC}/index.ts`,
			layout,
		);

		expect(changes).toEqual([{ before: '~/managers/utils' }]);
	});

	test('leaves another package alone', () => {
		const source = "import db from '~/managers/base';\n";

		expect(rewriteSource(source, 'apps/web/src/a.ts', 'apps/web/src/a.ts', layout).text).toBe(
			source,
		);
	});
});
