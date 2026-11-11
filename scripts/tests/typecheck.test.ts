import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

import { summarize, typecheckProjects, typeErrors } from '~/typecheck';
import { loadProjects } from '~/workspaces';

const root = resolve(import.meta.dir, '../..');

function trackedTsconfigDirs(): string[] {
	const listed = Bun.spawnSync(['git', 'ls-files', '--', 'tsconfig.json', '**/tsconfig.json'], {
		cwd: root,
	});

	return listed.stdout.toString().split('\n').filter(Boolean).map(dirname);
}

describe('typecheck', () => {
	test('picks only error lines out of tsc output', () => {
		const output =
			'src/a.ts(1,2): error TS2322: Type mismatch.\n  Details\nsrc/b.ts(3,4): error TS2345: Bad argument.';

		expect(typeErrors(output)).toEqual([
			'src/a.ts(1,2): error TS2322: Type mismatch.',
			'src/b.ts(3,4): error TS2345: Bad argument.',
		]);
	});

	test('names each failing project and counts them', () => {
		const { lines, ok } = summarize([
			{ project: 'packages/a', errors: ['x.ts(1,1): error TS1: bad'] },
			{ project: 'packages/b', errors: [] },
		]);

		expect(ok).toBe(false);
		expect(lines).toEqual([
			'packages/a/x.ts(1,1): error TS1: bad',
			'1 of 2 projects have type errors.',
		]);
	});

	test('reports a clean run', () => {
		expect(summarize([{ project: 'packages/a', errors: [] }])).toEqual({
			lines: ['All 1 projects type-check.'],
			ok: true,
		});
	});

	test('covers every project with a tsconfig', () => {
		for (const project of typecheckProjects())
			expect(existsSync(join(root, project, 'tsconfig.json'))).toBe(true);
	});

	// Plugins are type-checked by `plugins:typecheck`; fixtures and templates are inputs, not projects.
	test('type-checks every tsconfig in the repository', () => {
		const checked = new Set(typecheckProjects());
		const skipped = new Set(
			loadProjects()
				.filter((project) => project.plugin || project.checks.typecheck === false)
				.map((project) => project.dir),
		);
		const unchecked = trackedTsconfigDirs()
			.filter((dir) => !/(^|\/)(fixtures|templates|docs-fixture)(\/|$)/.test(dir))
			.filter((dir) => dir !== '.' && !checked.has(dir) && !skipped.has(dir));

		expect(unchecked).toEqual([]);
		expect(checked).toContain('apps/discord-typegen');
	});

	test('leaves the plugins to plugins:typecheck', () => {
		expect(typecheckProjects()).not.toContain('packages/plugins/chat-bubbles');
		expect(typecheckProjects()).not.toContain('packages/plugins');
	});
});
