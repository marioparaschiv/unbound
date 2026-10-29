import { expect, test } from 'bun:test';

import {
	checkFromCycle,
	cycleScript,
	fixtureScript,
	parseChannel,
	applyOffMainPolicy,
	parseOffMainWarnings,
	withReconnects,
	type CycleResult,
} from './collect-device-matrix';
import { validateDeviceMatrix } from './device-matrix';

const healthy: CycleResult = {
	id: 'unbound.alpha',
	installed: true,
	wasStarted: true,
	error: '',
	restarted: true,
	updateError: '',
	updated: true,
	hooksBefore: 12,
	hooksStopped: 9,
	hooksAfter: 12,
	hooksUpdated: 12,
};

test('a clean cycle passes with its hook counts and screenshot as evidence', () => {
	expect(checkFromCycle(healthy, 'unbound.alpha.png')).toEqual({
		id: 'unbound.alpha',
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: ['cycle: hooks 12→9→12→12', 'screenshot: unbound.alpha.png'],
		metrics: { stopMs: 0, startMs: 0, leakedHooks: 0 },
	});
});

test('a plugin that is not installed fails with a note', () => {
	const check = checkFromCycle({ ...healthy, installed: false });

	expect(check.behavior).toBe('fail');
	expect(check.note).toBe('Not installed on the device.');
});

test('leaked hooks fail the lifecycle but not the behavior', () => {
	const check = checkFromCycle({ ...healthy, hooksAfter: 14, hooksUpdated: 14 });

	expect(check.behavior).toBe('pass');
	expect(check.lifecycle).toBe('fail');
	expect(check.note).toBe('restarting leaked 2 native hooks');
});

test('a failed reload fails both checks', () => {
	const check = checkFromCycle({ ...healthy, updateError: 'boom', updated: false });

	expect(check.behavior).toBe('fail');
	expect(check.lifecycle).toBe('fail');
	expect(check.note).toBe('reload failed: boom');
});

test('every collected check is valid for the matrix', () => {
	const catalog = [
		{ id: 'unbound.alpha', name: 'Alpha' },
		{ id: 'unbound.beta', name: 'Beta' },
	];
	const checks = [
		checkFromCycle(healthy),
		checkFromCycle({ ...healthy, id: 'unbound.beta', error: 'threw on start' }),
	];

	expect(validateDeviceMatrix(catalog, checks)).toEqual([]);
});

test('the cycle script names the plugin it cycles and parses', () => {
	const script = cycleScript('unbound.alpha');

	expect(script).toContain('"unbound.alpha"');
	expect(() => new Function(`return ${script}`)).not.toThrow();
});

test('a passing self-test is recorded as evidence', () => {
	const check = checkFromCycle({ ...healthy, selfTest: { ok: true, detail: 'sample cleaned' } });

	expect(check.behavior).toBe('pass');
	expect(check.evidence).toContain('self-test: sample cleaned');
});

test('a failing self-test fails the behavior with its detail', () => {
	const check = checkFromCycle({ ...healthy, selfTest: { ok: false, detail: 'used 1 colors' } });

	expect(check.behavior).toBe('fail');
	expect(check.lifecycle).toBe('pass');
	expect(check.note).toBe('self-test failed: used 1 colors');
});

test('retries an evaluation the device dropped, then gives up', async () => {
	let calls = 0;
	const flaky = async () => {
		calls++;
		if (calls < 2)
			throw new Error(
				'Evaluation failed: "Device disconnected before the evaluation completed."',
			);

		return 'ok';
	};

	expect(await withReconnects(flaky, async () => undefined)).toBe('ok');

	const gone = async () => {
		throw new Error('Evaluation failed: "No device is connected to the debugger."');
	};

	await expect(withReconnects(gone, async () => undefined, 2)).rejects.toThrow('No device');
});

test('does not retry other evaluation failures', async () => {
	let calls = 0;
	const broken = async () => {
		calls++;
		throw new Error('Evaluation failed: "TypeError"');
	};

	await expect(withReconnects(broken, async () => undefined)).rejects.toThrow('TypeError');
	expect(calls).toBe(1);
});

test('reads a fixture channel as guild and channel ids', () => {
	expect(parseChannel('709061970078335027/709062739581992971')).toEqual({
		guild: '709061970078335027',
		channel: '709062739581992971',
	});
	expect(() => parseChannel('development')).toThrow('<guild id>/<channel id>');
});

test('the fixture script opens the channel and injects local messages only', () => {
	const script = fixtureScript('1', '2');

	expect(script).toContain('transitionToGuild("1", "2")');
	expect(script).toContain('receiveMessage');
	expect(script).not.toContain('sendMessage(');
	expect(() => new Function(`return ${script}`)).not.toThrow();
});

test('reads the off-main view calls each plugin made since the run began', () => {
	const lines = [
		'2026-10-29T17:00:00.000Z W [plugins] Chat Bubbles called -[UIView layer] off the main thread. Views are only safe on the main thread; use invokeAsync instead.',
		'2026-10-29T18:00:01.000Z W [plugins] Chat Bubbles called -[UIView bounds] off the main thread. Views are only safe on the main thread; use invokeAsync instead.',
		'2026-10-29T18:00:02.000Z W [plugins] Chat Bubbles called -[UIView bounds] off the main thread. Views are only safe on the main thread; use invokeAsync instead.',
		'2026-10-29T18:00:03.000Z W [plugins] Avatar Radius called android.view.View.getWidth() off the main thread. Views are only safe on the main thread; use invokeAsync instead.',
		'2026-10-29T18:00:04.000Z I [plugins] unrelated',
	];

	expect(parseOffMainWarnings(lines, '2026-10-29T18:00:00.000Z')).toEqual(
		new Map([
			['Chat Bubbles', ['-[UIView bounds]']],
			['Avatar Radius', ['android.view.View.getWidth()']],
		]),
	);
});

test('fails a plugin for off-main calls it did not make last run, or for any with --strict', () => {
	const check = {
		id: 'unbound.alpha',
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: [],
	} as const;
	const current = [{ ...check, evidence: [], offMainCalls: ['a()', 'b()'] }];
	const baseline = [{ ...check, evidence: [], offMainCalls: ['a()'] }];

	expect(applyOffMainPolicy(current, baseline, false)[0]).toMatchObject({
		behavior: 'fail',
		note: 'new off-main view calls: b()',
	});
	expect(applyOffMainPolicy(current, undefined, false)[0]!.behavior).toBe('pass');
	expect(applyOffMainPolicy(current, baseline, true)[0]).toMatchObject({
		behavior: 'fail',
		note: 'off-main view calls: a(), b()',
	});
});
