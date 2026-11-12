import { expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import { readPreferences } from '~/lib/preferences';

test('reads the defaults', () => {
	expect(readPreferences()).toEqual({
		theme: 'dark-plus',
		opacity: 100,
		overflow: 'wrap',
		iconMode: 'greyscale',
		hljs: 'secondary',
	});
});

test('lets a custom theme URL win over the picked theme', () => {
	settings.theme = 'nord';
	settings.customTheme = ' https://example.com/theme.json ';

	expect(readPreferences().theme).toBe('custom:https://example.com/theme.json');
});
