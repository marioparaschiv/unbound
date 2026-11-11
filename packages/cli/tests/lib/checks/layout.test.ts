import { afterEach, describe, expect, test } from 'bun:test';

import { findLayoutIssues } from '~/lib/checks/layout';

import { createTempDir, type TempDir } from '../../helpers/ubd';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

function plugin(files: Record<string, string>): string {
	const dir = createTempDir({ 'src/index.tsx': '', ...files });

	dirs.push(dir);

	return dir.path;
}

function flaggedFiles(files: Record<string, string>): string[] {
	return findLayoutIssues(plugin(files)).map((issue) => issue.file);
}

describe('findLayoutIssues', () => {
	test('accepts files one level down in a standard folder', () => {
		expect(
			flaggedFiles({
				'src/patches.ts': '',
				'src/native/hooks.ts': '',
				'src/lib/limit.ts': '',
			}),
		).toEqual([]);
	});

	test('accepts platform-native files in src/native/ios/ and src/native/android/', () => {
		expect(
			flaggedFiles({
				'src/native/views.ts': '',
				'src/native/ios/views.ts': '',
				'src/native/android/views.ts': '',
			}),
		).toEqual([]);
	});

	test('flags folders nested below a platform folder', () => {
		expect(flaggedFiles({ 'src/native/ios/cells/heights.ts': '' })).toEqual([
			'src/native/ios/cells',
		]);
	});

	test('flags platform folders outside src/native/', () => {
		expect(
			flaggedFiles({
				'src/lib/ios/colors.ts': '',
				'src/patches/android/rows.ts': '',
				'src/native/web/views.ts': '',
			}),
		).toEqual(['src/lib/ios', 'src/native/web', 'src/patches/android']);
	});
});
