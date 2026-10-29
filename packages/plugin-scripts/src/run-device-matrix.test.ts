import { expect, test } from 'bun:test';

import { collectorArgs, deviceSlug, parseMatrixConfig } from './matrix-config';
import type { MeasuredCheck } from './compare-device-matrix';
import { renderSummary } from './run-device-matrix';

const phone = { name: 'iPhone SE', port: 9090, udid: 'abc' };
const emulator = { name: 'Android Emulator', port: 9091, serial: 'emulator-5554' };

test('reads the fixture channel and devices from the config', () => {
	const config = parseMatrixConfig(
		JSON.stringify({ channel: '1/2', devices: [phone, emulator] }),
	);

	expect(config).toEqual({ channel: '1/2', devices: [phone, emulator] });
	expect(() => parseMatrixConfig(JSON.stringify({ devices: [{ name: 'x' }] }))).toThrow();
});

test('passes each device its own target, channel and filter', () => {
	expect(deviceSlug(phone)).toBe('iphone-se');
	expect(collectorArgs(emulator, '/out/android', '1/2', 'unbound.alpha')).toEqual([
		'--port',
		'9091',
		'--out',
		'/out/android',
		'--device',
		'Android Emulator',
		'--serial',
		'emulator-5554',
		'--channel',
		'1/2',
		'--only',
		'unbound.alpha',
	]);
});

test('summarises every device and lists only the plugins that failed somewhere', () => {
	const pass = (id: string): MeasuredCheck => ({
		id,
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: [],
	});
	const summary = renderSummary([
		{ device: phone, checks: [pass('unbound.alpha'), pass('unbound.beta')], changes: [] },
		{
			device: emulator,
			checks: [
				pass('unbound.alpha'),
				{
					id: 'unbound.beta',
					behavior: 'fail',
					lifecycle: 'pass',
					evidence: [],
					note: 'no embeds',
					offMainCalls: ['android.view.View.getWidth()'],
				},
			],
			changes: ['unbound.beta now fails'],
		},
	]);

	expect(summary).toContain('- **iPhone SE:** 2/2 passed');
	expect(summary).toContain('- **Android Emulator:** 1/2 passed');
	expect(summary).toContain('| unbound.beta | pass | **fail**: no embeds |');
	expect(summary).not.toContain('| unbound.alpha |');
	expect(summary).toContain('- Android Emulator: unbound.beta now fails');
	expect(summary).toContain('- Android Emulator, unbound.beta: `android.view.View.getWidth()`');
});
