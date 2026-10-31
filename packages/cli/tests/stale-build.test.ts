import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { staleBuildReason } from '../src/lib/stale-build';

const directories: string[] = [];

function addon() {
	const dir = mkdtempSync(join(tmpdir(), 'stale-build-'));

	directories.push(dir);
	mkdirSync(join(dir, 'src'));
	mkdirSync(join(dir, 'dist'));
	writeFileSync(
		join(dir, 'manifest.json'),
		JSON.stringify({
			id: 'unbound.alpha',
			name: 'Alpha',
			description: 'A test plugin.',
			authors: [{ name: 'Mario', id: '1' }],
			main: 'src/index.ts',
			version: '1.0.0',
		}),
	);
	writeFileSync(join(dir, 'src', 'index.ts'), 'export default {};');
	writeFileSync(join(dir, 'dist', 'index.js'), 'bundle');

	const at = (path: string, seconds: number) => utimesSync(join(dir, path), seconds, seconds);

	at('manifest.json', 1_000);
	at('src/index.ts', 1_000);
	at('dist/index.js', 2_000);

	return {
		built: {
			id: 'unbound.alpha',
			kind: 'plugin',
			dir,
			output: join(dir, 'dist'),
			static: false,
		} as const,
		at,
	};
}

function linkShared(addonDir: string, dependencies: Record<string, string>) {
	const shared = mkdtempSync(join(tmpdir(), 'stale-shared-'));

	directories.push(shared);
	mkdirSync(join(shared, 'src'));
	writeFileSync(join(shared, 'package.json'), JSON.stringify({ name: '@scope/shared' }));
	writeFileSync(join(shared, 'src', 'util.ts'), 'export {};');
	writeFileSync(join(shared, 'src', 'util.test.ts'), 'test');
	writeFileSync(join(addonDir, 'package.json'), JSON.stringify({ dependencies }));
	mkdirSync(join(addonDir, 'node_modules', '@scope'), { recursive: true });
	symlinkSync(shared, join(addonDir, 'node_modules', '@scope', 'shared'));

	const at = (path: string, seconds: number) => utimesSync(join(shared, path), seconds, seconds);

	at('package.json', 1_000);
	at('src/util.ts', 1_000);
	at('src/util.test.ts', 1_000);
	utimesSync(join(addonDir, 'package.json'), 1_000, 1_000);

	return at;
}

afterEach(() => {
	for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('staleBuildReason', () => {
	test('accepts a bundle newer than every source file', () => {
		expect(staleBuildReason(addon().built)).toBeUndefined();
	});

	test('names the source file edited after the bundle was built', () => {
		const { built, at } = addon();

		at('src/index.ts', 3_000);

		expect(staleBuildReason(built)).toBe(
			'dist/index.js is older than src/index.ts; build it again.',
		);
	});

	test('notices a build that did not write the bundle', () => {
		expect(staleBuildReason(addon().built, 5_000_000)).toBe(
			'The build did not write dist/index.js.',
		);
	});

	test('names a shared workspace file edited after the bundle was built', () => {
		const { built } = addon();
		const at = linkShared(built.dir, { '@scope/shared': 'workspace:*' });

		at('src/util.ts', 3_000);

		expect(staleBuildReason(built)).toBe(
			'dist/index.js is older than @scope/shared/src/util.ts; build it again.',
		);
	});

	test('ignores shared test files and packages that are not workspace links', () => {
		const { built } = addon();
		const testOnly = linkShared(built.dir, { '@scope/shared': 'workspace:*' });

		testOnly('src/util.test.ts', 3_000);

		expect(staleBuildReason(built)).toBeUndefined();

		const other = addon();
		const registry = linkShared(other.built.dir, { '@scope/shared': '^1.0.0' });

		registry('src/util.ts', 3_000);

		expect(staleBuildReason(other.built)).toBeUndefined();
	});
});
