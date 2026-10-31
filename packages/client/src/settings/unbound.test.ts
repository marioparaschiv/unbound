import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';
import { expect, test } from 'bun:test';

import { snapshot } from '~/storage/api';

import { getSetting, isSettingChange, setSetting, toggleSetting } from './unbound';

const settings = snapshot();

test('falls back to the default until a value is stored', () => {
	delete settings[CORE_SETTINGS_STORE];

	expect(getSetting('toasts.duration')).toBe(5000);
	expect(getSetting('toasts.maxOnScreen')).toBe(3);
	expect(getSetting('recovery')).toBe(false);

	setSetting('toasts.duration', 2000);

	expect(getSetting('toasts.duration')).toBe(2000);
});

test('reads and writes the persisted key paths saved settings already use', () => {
	settings[CORE_SETTINGS_STORE] = { toasts: { maxOnScreen: 7 }, recovery: true };

	expect(getSetting('toasts.maxOnScreen')).toBe(7);
	expect(getSetting('recovery')).toBe(true);

	toggleSetting('recovery');
	setSetting('debugger.address', '10.0.0.2:9090');

	expect(settings[CORE_SETTINGS_STORE]).toEqual({
		toasts: { maxOnScreen: 7 },
		recovery: false,
		debugger: { address: '10.0.0.2:9090' },
	});
});

test('matches a change only to the same key of the core store', () => {
	expect(
		isSettingChange(
			{ store: CORE_SETTINGS_STORE, key: 'staff-mode', value: true },
			'staff-mode',
		),
	).toBe(true);
	expect(
		isSettingChange({ store: 'plugins', key: 'staff-mode', value: true }, 'staff-mode'),
	).toBe(false);
});
