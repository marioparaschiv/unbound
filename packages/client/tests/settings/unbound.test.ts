import { CORE_BUCKET } from '@unbound-app/types/settings';
import { expect, test } from 'bun:test';

import { getSetting, isSettingChange, setSetting, toggleSetting } from '~/settings/unbound';
import { getBucket, snapshot } from '~/storage/api';

import contract from '../../../debugger-protocol/tests/fixtures/devtools-contract.json';

const settings = snapshot();

test('falls back to the default until a value is stored', () => {
	delete settings[CORE_BUCKET];

	expect(getSetting('toasts.duration')).toBe(5000);
	expect(getSetting('toasts.maxOnScreen')).toBe(3);
	expect(getSetting('recovery')).toBe(false);

	setSetting('toasts.duration', 2000);

	expect(getSetting('toasts.duration')).toBe(2000);
});

test('reads and writes the persisted key paths saved settings already use', () => {
	settings[CORE_BUCKET] = { toasts: { maxOnScreen: 7 }, recovery: true };

	expect(getSetting('toasts.maxOnScreen')).toBe(7);
	expect(getSetting('recovery')).toBe(true);

	toggleSetting('recovery');
	setSetting('debugger.address', '10.0.0.2:9090');

	expect(settings[CORE_BUCKET]).toEqual({
		toasts: { maxOnScreen: 7 },
		recovery: false,
		debugger: { address: '10.0.0.2:9090' },
	});
});

// The DevTools app's connect script reads the address through this lookup, named in the shared contract.
test('keeps the debugger address where the DevTools app reads it', () => {
	const { store, key } = contract.addressSetting;

	setSetting('debugger.address', '10.0.0.3:9090');

	expect(getBucket(store).get(key, '')).toBe('10.0.0.3:9090');
});

test('matches a change only to the same key of the core store', () => {
	expect(
		isSettingChange({ store: CORE_BUCKET, key: 'staff-mode', value: true }, 'staff-mode'),
	).toBe(true);
	expect(
		isSettingChange({ store: 'plugins', key: 'staff-mode', value: true }, 'staff-mode'),
	).toBe(false);
});
