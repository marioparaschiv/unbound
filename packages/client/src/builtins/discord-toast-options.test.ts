import { expect, test } from 'bun:test';

import { hasVisibleContent } from '~/lib/toast-content';

import discordToastOptions from './discord-toast-options';

test('shows Discord content as the toast title', () => {
	const mapped = discordToastOptions({ content: 'Copied' });

	expect(mapped?.title).toBe('Copied');
	expect(mapped?.content).toBeUndefined();
	expect(mapped?.duration).toBe(5000);
});

test('keeps a Discord title and puts the content under it', () => {
	const mapped = discordToastOptions({ title: 'Upload', content: 'Done' });

	expect(mapped?.title).toBe('Upload');
	expect(mapped?.content).toBe('Done');
});

test('drops Discord toasts with nothing to show', () => {
	expect(discordToastOptions({})).toBeNull();
	expect(discordToastOptions({ content: '   ' })).toBeNull();
	expect(discordToastOptions({ content: { message: 'x' } })).toBeNull();
});

test('reuses one toast for repeated opens of the same Discord key', () => {
	expect(discordToastOptions({ key: 'copy', content: 'Copied' })?.id).toBe('discord:copy');
	expect(discordToastOptions({ key: 'copy', id: 'own', content: 'Copied' })?.id).toBe('own');
});

test('treats a toast with only buttons as visible', () => {
	expect(hasVisibleContent({ buttons: [{ content: 'Retry', onPress() {} }] })).toBe(true);
	expect(hasVisibleContent({ title: '' })).toBe(false);
});
