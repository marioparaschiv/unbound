import { startPlugin, stopPlugin, toasts } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

describe('start', () => {
	test('greets with the plugin name', async () => {
		await startPlugin();

		expect(toasts.shown).toMatchObject([
			{ key: 'GREETING_BODY', title: '{{displayName}} is running.' },
		]);
		await stopPlugin();
	});

	test('stays quiet when greetOnStart is off', async () => {
		settings.greetOnStart = false;
		await startPlugin();

		expect(toasts.shown).toEqual([]);
		await stopPlugin();
	});
});
