import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
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
	writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ main: 'src/index.ts' }));
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
});
