import { render, startPlugin, stopPlugin, toasts } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { SettingsPanel, settings } from '@unbound-app/settings';

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

test('empties the word list when the generated Clear cache row is pressed', async () => {
	settings.words = ['one', 'two'];

	const view = render(<SettingsPanel />);
	const row = view.findAll('ButtonRow').find((node) => node.props.title === 'Clear cache');

	await row?.props.onPress();

	expect(row?.props.confirm).toBe('Clear the cache? Your saved words are removed.');
	expect(settings.words).toEqual([]);
	expect(toasts.shown).toMatchObject([
		{ title: 'Settings Demo', content: 'clearCache ran: the word list is empty.' },
	]);
});
