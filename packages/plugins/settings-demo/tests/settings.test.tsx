import { startPlugin, stopPlugin, toasts } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import { clearCache } from '~/actions';

test('starts with every setting at its default', async () => {
	await startPlugin();

	expect(settings.style).toBe('cozy');
	expect(settings.retries).toBe(3);
	expect(settings.appearance.accent).toBe('#5865F2');
	await stopPlugin();
});

test('keeps the Clear cache button out of the stored settings', () => {
	expect(Object.keys(settings)).not.toContain('clearCache');
});

test('empties the word list and says so when Clear cache runs', () => {
	settings.words = ['one', 'two'];

	clearCache();

	expect(settings.words).toEqual([]);
	expect(toasts.shown).toMatchObject([
		{ title: 'Settings Demo', content: 'clearCache ran: the word list is empty.' },
	]);
});
