import {
	createFakeSettings,
	createMemoryStorage,
	defineSettings,
	setting,
} from '@unbound-app/api/testing';
import { expect, mock, test } from 'bun:test';

const storage = createMemoryStorage('plugin');

const settings = createFakeSettings(
	defineSettings({
		feature: setting.boolean({ default: true, title: 'FEATURE' }),
		advanced: setting.section(
			{ title: 'ADVANCED' },
			{
				deep: setting.boolean({ default: false, title: 'DEEP' }),
			},
		),
	}),
	storage,
	'plugin',
);

mock.module('@unbound-app/api/storage', () => ({ onChange: storage.onChange }));
mock.module('@unbound-app/settings', () => ({ settings: settings.settings }));

const { default: whileEnabled } = await import('~/settings/while-enabled');

test('runs enable while a setting is on, from its default, and cleanup when it turns off', () => {
	const calls: string[] = [];
	const stop = whileEnabled('feature', () => {
		calls.push('on');

		return () => void calls.push('off');
	});

	settings.set('feature', false);
	settings.set('feature', true);
	stop();

	expect(calls).toEqual(['on', 'off', 'on', 'off']);
});

test('reads keys inside sections', () => {
	const calls: string[] = [];
	const stop = whileEnabled('advanced.deep', () => {
		calls.push('deep on');

		return () => void calls.push('deep off');
	});

	settings.set('advanced.deep', true);
	settings.set('advanced.deep', false);
	settings.set('advanced.deep', true);
	stop();

	expect(calls).toEqual(['deep on', 'deep off', 'deep on', 'deep off']);
});
