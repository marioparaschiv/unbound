import {
	createFakeSettings,
	createMemoryStorage,
	defineSettings,
	setting,
} from '@unbound-app/api/testing';
import { expect, mock, test } from 'bun:test';

const storage = createMemoryStorage('plugin');

mock.module('@unbound-app/api/storage', () => ({ onChange: storage.onChange }));

const { default: whileEnabled } = await import('@unbound-plugins/shared/settings/while-enabled');

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

test('runs enable while a Bucket key is on, and cleanup when it turns off', () => {
	const bucket = storage.getBucket();
	const calls: string[] = [];
	const stop = whileEnabled(bucket, 'flag', false, () => {
		calls.push('on');

		return () => void calls.push('off');
	});

	bucket.set('flag', true);
	bucket.set('flag', false);
	stop();

	expect(calls).toEqual(['on', 'off']);
});

test('takes the settings object of @unbound-app/settings, keys inside sections too', () => {
	const calls: string[] = [];
	const stopFeature = whileEnabled(settings.settings, 'feature', true, () => {
		calls.push('feature on');

		return () => void calls.push('feature off');
	});
	const stopDeep = whileEnabled(settings.settings, 'advanced.deep', false, () => {
		calls.push('deep on');

		return () => void calls.push('deep off');
	});

	settings.set('feature', false);
	settings.set('advanced.deep', true);
	stopFeature();
	stopDeep();

	expect(calls).toEqual(['feature on', 'feature off', 'deep on', 'deep off']);
});
