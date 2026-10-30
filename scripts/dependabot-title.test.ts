import { describe, expect, test } from 'bun:test';

import { shortenDependabotTitle } from './dependabot-title';

describe('Dependabot titles', () => {
	test('keeps a title that already fits', () => {
		expect(
			shortenDependabotTitle(
				'build(deps): bump the minor-and-patch group with 7 updates',
				607,
			),
		).toBe('build(deps): bump the minor-and-patch group with 7 updates');
	});

	test('drops the old version, paths and group names', () => {
		expect(
			shortenDependabotTitle(
				'build(deps): bump com.android.application from 9.4.1 to 9.5.0 in /packages/loader/android in the minor-and-patch group',
				606,
			),
		).toBe('build(deps): bump com.android.application to 9.5.0');
		expect(
			shortenDependabotTitle(
				'ci(deps): bump castdrian/dkrypt from 1.1.1 to 1.3.0 in the actions group across 1 directory',
				608,
			),
		).toBe('ci(deps): bump castdrian/dkrypt to 1.3.0');
	});

	test('falls back to the group, then to a plain bump, when names are long', () => {
		const long = 'a'.repeat(60);

		expect(
			shortenDependabotTitle(
				`build(deps): bump the minor-and-patch group across 2 directories with 9 updates ${long}`,
				610,
			),
		).toBe('build(deps): bump the minor-and-patch group');
		expect(shortenDependabotTitle(`build(deps): bump ${long} from 1.0.0 to 2.0.0`, 611)).toBe(
			'build(deps): bump dependencies',
		);
	});

	test('every result fits the header limit', () => {
		for (const title of [
			'build(deps): bump @babel/plugin-transform-block-scoping from 7.29.11 to 8.0.8',
			`ci(deps): bump ${'b'.repeat(80)} from 1 to 2`,
		]) {
			expect(`${shortenDependabotTitle(title, 12345)} (#12345)`.length).toBeLessThanOrEqual(
				72,
			);
		}
	});
});
