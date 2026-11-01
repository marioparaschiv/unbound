import { describe, expect, test } from 'bun:test';
import { join, posix } from 'node:path';
import { readFileSync } from 'node:fs';

import { kept, moves, removals } from './table';
import { isStub } from './index';

const SOURCE = join(import.meta.dir, '../../src');
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const BUILTIN = /^[^/]+\/builtin\.tsx?$/;

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
	'account',
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

function destinationOf(path: string): string | undefined {
	for (const [from, to] of Object.entries(moves)) {
		if (path === from) {
			return to;
		}

		if (from.endsWith('/') && path.startsWith(from)) {
			return to + path.slice(from.length);
		}
	}

	return void 0;
}

function importsUi(path: string): boolean {
	const text = readFileSync(join(SOURCE, path), 'utf8');

	return [...text.matchAll(SPECIFIER)].some(([, specifier = '']) => {
		const named = specifier.startsWith('.')
			? posix.join(posix.dirname(path), specifier)
			: specifier.replace(/^~\//, '');

		const moving = ['', '.ts', '.tsx', '/index.ts'].some((extension) =>
			destinationOf(named + extension),
		);

		return !moving && (named === 'ui' || named.startsWith('ui/'));
	});
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

	test('moves no ui/ import into a domain file other than its builtin or the public barrel (D14, D16)', () => {
		const offenders = sourceFiles().flatMap((path) => {
			const destination = destinationOf(path) ?? path;
			const domain = destination.split('/')[0] ?? '';

			if (
				!DOMAINS.has(domain) ||
				BUILTIN.test(destination) ||
				kept.includes(destination) ||
				destination === 'core/api.ts'
			) {
				return [];
			}

			return importsUi(path) ? [destination] : [];
		});

		expect(offenders).toEqual([]);
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
