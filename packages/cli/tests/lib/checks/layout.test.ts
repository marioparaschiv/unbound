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

	test('accepts platform files in a standard folder ios/ and android/', () => {
		expect(
			flaggedFiles({
				'src/native/views.ts': '',
				'src/native/ios/views.ts': '',
				'src/native/android/views.ts': '',
				'src/lib/ios/colors.ts': '',
				'src/patches/android/rows.tsx': '',
			}),
		).toEqual([]);
	});

	test('flags files that name their platform in a suffix', () => {
		expect(
			findLayoutIssues(
				plugin({
					'src/lib/colors-ios.ts': '',
					'src/patches/rows-android.tsx': '',
					'src/lib/ios-colors.ts': '',
				}),
			),
		).toEqual([
			{
				file: 'src/lib/colors-ios.ts',
				message: 'names its platform in a suffix',
				fix: 'move it to src/lib/ios/colors.ts',
			},
			{
				file: 'src/patches/rows-android.tsx',
				message: 'names its platform in a suffix',
				fix: 'move it to src/patches/android/rows.tsx',
			},
		]);
	});

	test('flags folders nested below a platform folder', () => {
		expect(flaggedFiles({ 'src/native/ios/cells/heights.ts': '' })).toEqual([
			'src/native/ios/cells',
		]);
	});

	test('flags folders that are not a platform', () => {
		expect(
			flaggedFiles({
				'src/lib/helpers/colors.ts': '',
				'src/native/web/views.ts': '',
			}),
		).toEqual(['src/lib/helpers', 'src/native/web']);
	});
});
