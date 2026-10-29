import { expect, test } from 'bun:test';

import findSettingsOverview from './find-settings-overview';

test('finds an anonymous settings overview export by its Metro path', () => {
	const overview = { default: () => null };
	const paths: string[] = [];
	const found = findSettingsOverview(
		() => undefined,
		(path) => {
			paths.push(path);

			return overview;
		},
	);

	expect(found).toBe(overview);
	expect(paths).toContain('modules/user_settings/overview/native/SettingsOverviewScreen.tsx');
});

test('prefers a named settings overview when Discord exports one', () => {
	const overview = { default: () => null };
	const found = findSettingsOverview(
		() => overview,
		() => {
			throw new Error('Path fallback should not run.');
		},
	);

	expect(found).toBe(overview);
});
