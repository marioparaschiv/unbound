import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { kept, moves, removals } from './table';
import { isStub } from './index';

const SOURCE = join(import.meta.dir, '../../src');

/** The plan §1 domains, plus the three folders for modules the plan does not name. */
const DOMAINS = new Set([
	'core',
	'metro',
	'flux',
	'patcher',
	'commands',
	'storage',
	'native',
	'assets',
	'i18n',
	'toasts',
	'settings',
	'addons',
	'plugins',
	'themes',
	'icon-packs',
	'fonts',
	'marketplace',
	'updates',
	'sync',
	'builtins',
	'debugger',
	'hot-refresh',
	'dialogs',
	'diagnostics',
	'links',
]);

function sourceFiles(): string[] {
	const files = new Bun.Glob('**/*').scanSync({ cwd: SOURCE });

	return [...files].filter((path) => !isStub(readFileSync(join(SOURCE, path), 'utf8')));
}

describe('domain move table', () => {
	test('every destination is a domain folder and no two rows share one', () => {
		const targets = Object.values(moves);

		expect(new Set(targets).size).toBe(targets.length);

		for (const target of targets) {
			expect(DOMAINS.has(target.split('/')[0] ?? '')).toBe(true);
		}
	});

	test('covers every module outside ui/ and the new domain folders', () => {
		const rows = Object.keys(moves);
		const uncovered = sourceFiles().filter((path) => {
			const domain = path.includes('/') ? path.split('/')[0] : undefined;

			if (domain === 'ui' || (domain && DOMAINS.has(domain))) {
				return false;
			}

			return !rows.some((row) => path === row || (row.endsWith('/') && path.startsWith(row)));
		});

		expect(uncovered.filter((path) => !removals.includes(path))).toEqual([]);
	});

	test('leaves only the kept built-ins in builtins/', () => {
		const targets = Object.values(moves);
		const builtins = sourceFiles().filter(
			(path) => path.startsWith('builtins/') && !(path in moves) && !targets.includes(path),
		);

		expect(builtins.toSorted()).toEqual(kept.toSorted());
	});

	test('deletes exactly the plan §1 files in contract mode', () => {
		expect(removals.toSorted()).toEqual(
			[
				'lib/force-render.ts',
				'managers/utils.ts',
				'ui/addons/index.ts',
				'ui/components/index.ts',
				'ui/hooks/index.ts',
				'ui/marketplace/index.ts',
				'ui/toasts/index.ts',
			].toSorted(),
		);
	});
});
