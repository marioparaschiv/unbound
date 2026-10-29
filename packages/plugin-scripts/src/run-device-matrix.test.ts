import { expect, test } from 'bun:test';

import { collectorArgs, deviceSlug, parseMatrixConfig } from './matrix-config';
import type { MeasuredCheck } from './compare-device-matrix';
import { failureReason, listCalls, renderSummary, runFailed } from './run-device-matrix';

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

test('caps the off-main calls listed for a plugin', () => {
	const calls = Array.from({ length: 9 }, (_, index) => `View${index}.getChildAt()`);

	expect(listCalls(calls)).toEndWith('`View5.getChildAt()` and 3 more');
	expect(listCalls(calls.slice(0, 2))).toBe('`View0.getChildAt()`, `View1.getChildAt()`');
});

test('does not say everything passed when a device could not be checked', () => {
	const summary = renderSummary([
		{ device: phone, checks: [], changes: [], error: 'collector failed: timed out' },
		{ device: emulator, checks: [], changes: [] },
	]);

	expect(summary).toContain('- **iPhone SE:** collector failed: timed out');
	expect(summary).not.toContain('Every plugin passed');
});

test('names the collector error instead of the runtime footer', () => {
	expect(
		failureReason([
			'error: Evaluation failed: "Evaluation timed out after 60000ms."',
			'',
			'Bun v1.3.14 (macOS arm64)',
			'error: script "plugins:collect-device-matrix" exited with code 1',
		]),
	).toBe('Evaluation failed: "Evaluation timed out after 60000ms."');
});

test('fails a device that showed toasts while scrolling and lists them', () => {
	const check: MeasuredCheck = {
		id: 'unbound.alpha',
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: [],
	};
	const quiet = { device: phone, checks: [check], changes: [], scrollToasts: [] };
	const noisy = { device: emulator, checks: [check], changes: [], scrollToasts: ['empty toast'] };
	const summary = renderSummary([quiet, noisy]);

	expect(runFailed(quiet)).toBe(false);
	expect(runFailed(noisy)).toBe(true);
	expect(summary).toContain('### Toasts while scrolling\n\n- Android Emulator: empty toast');
	expect(summary).not.toContain('Every plugin passed on every device.');
});

test('lists skipped hooks without failing the run', () => {
	const check: MeasuredCheck = {
		id: 'unbound.chat-bubbles',
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: [],
		skippedHooks: ['setBackgroundColor:'],
	};
	const run = { device: phone, checks: [check], changes: [], scrollToasts: [] };
	const summary = renderSummary([run]);

	expect(runFailed(run)).toBe(false);
	expect(summary).toContain(
		'### Hooks skipped while JavaScript was busy\n\n- iPhone SE, unbound.chat-bubbles: `setBackgroundColor:`',
	);
});
