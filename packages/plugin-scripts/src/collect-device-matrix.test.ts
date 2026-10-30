import { expect, test } from 'bun:test';

import {
	parsePluginErrors,
	parseOffMainWarnings,
	parseToastLines,
	parseSkippedHooks,
	toastCaller,
} from './log-parsers';
import {
	cycleScript,
	fixtureScript,
	fixturesPresentScript,
	type CycleResult,
} from './device-scripts';
import { withReconnects, parseScreenSize, swipeCommands } from './device-io';
import { checkFromCycle, applyLogPolicy } from './matrix-policy';
import { parseChannel } from './collect-device-matrix';
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

	expect(applyLogPolicy(current, baseline, false)[0]).toMatchObject({
		behavior: 'fail',
		note: 'new off-main view calls: b()',
	});
	expect(applyLogPolicy(current, undefined, false)[0]!.behavior).toBe('pass');
	expect(applyLogPolicy(current, baseline, true)[0]).toMatchObject({
		behavior: 'fail',
		note: 'off-main view calls: a(), b()',
	});
});

test('checks that the fixture channel is open and its fixtures are still loaded', () => {
	const script = fixturesPresentScript('2');

	expect(script).toContain('getMessages("2")');
	expect(script).toContain('Plain fixture message for bubbles and avatars.');
	expect(script).toContain("'present' : 'missing'");
});

test('attributes native hook failures and console errors to plugins', () => {
	const lines = [
		'2026-10-29T18:00:01.000Z E [plugins] Native plugin hook failed in Chat Bubbles: Native hook arguments cannot cross runtime threads',
		"2026-10-29T18:00:02.000Z E [console] '[More User Tags: gradients] Failed to paint an Android tag:', { [Error: boom] }",
		'2026-10-29T17:00:00.000Z E [plugins] Native plugin hook failed in Chat Bubbles: old',
		'2026-10-29T18:00:04.000Z E [updater] Bundle download failed.',
	];
	const errors = parsePluginErrors(lines, '2026-10-29T18:00:00.000Z');

	expect([...errors.keys()]).toEqual(['Chat Bubbles', 'More User Tags']);
	expect(errors.get('Chat Bubbles')).toEqual([
		'Native hook arguments cannot cross runtime threads',
	]);
	expect(errors.get('More User Tags')![0]).toStartWith('Failed to paint an Android tag:');
});

test('fails a plugin for errors it did not log last run', () => {
	const check = {
		id: 'unbound.alpha',
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: [],
	} as const;

	expect(
		applyLogPolicy(
			[{ ...check, evidence: [], errors: ['boom'] }],
			[{ ...check, evidence: [] }],
			false,
		)[0],
	).toMatchObject({ behavior: 'fail', note: 'new errors: boom' });
});

test('stages a reply, an attachment-only message and a forward beside the text fixtures', () => {
	const script = fixtureScript('1', '2');

	expect(script).toContain('Fixture reply to the message above');
	expect(script).toContain('message_snapshots');
	expect(script).toContain("filename: 'fixture.png'");
});

test('reads the physical screen size, preferring an override', () => {
	expect(parseScreenSize('Physical size: 1080x2400')).toEqual({ width: 1080, height: 2400 });
	expect(parseScreenSize('Physical size: 1080x2400\nOverride size: 720x1600')).toEqual({
		width: 720,
		height: 1600,
	});
	expect(parseScreenSize('')).toBeUndefined();
});

test('swipes towards older messages for the first half, then back', () => {
	const directions = swipeCommands({ kind: 'android' }, { width: 1080, height: 2400 }, 4).map(
		(command) => command.slice(-4, -1).join(' '),
	);

	expect(directions).toEqual(['720 540 1800', '720 540 1800', '1800 540 720', '1800 540 720']);

	const android = swipeCommands(
		{ kind: 'android', serial: 'emulator-5554' },
		{ width: 1080, height: 2400 },
		2,
	);

	expect(android).toEqual([
		[
			'adb',
			'-s',
			'emulator-5554',
			'shell',
			'input',
			'swipe',
			'540',
			'720',
			'540',
			'1800',
			'120',
		],
		[
			'adb',
			'-s',
			'emulator-5554',
			'shell',
			'input',
			'swipe',
			'540',
			'1800',
			'540',
			'720',
			'120',
		],
	]);

	const [ios] = swipeCommands({ kind: 'ios', udid: 'abc' }, { width: 1080, height: 2400 }, 1);

	expect(ios).toEqual([
		'jb-p1lot',
		'ui_action',
		'--device',
		'abc',
		'--action',
		'swipe',
		'--points',
		'[{"x":188,"y":200},{"x":188,"y":500}]',
	]);
});

test('lists the toasts shown or dropped after the scroll started', () => {
	const lines = [
		"2026-10-29T18:00:01.000Z I [console] '»', '[Toasts]', 'Showing a toast:', 'Before'",
		"2026-10-29T18:00:03.000Z I [console] '»', '[Toasts]', 'Showing a toast:', 'Copied'",
		"2026-10-29T18:00:04.000Z W [console] '»', '[Toasts]', 'Ignored a toast with nothing to show', 'Error\\n    at showToast (address at unbound:1:40533)\\n    at copyLink (address at unbound:1:9)'",
	];

	expect(parseToastLines(lines, '2026-10-29T18:00:02.000Z')).toEqual([
		'Copied',
		'empty toast from copyLink',
	]);
});

test('collects the hooks each plugin had skipped since the run began', () => {
	const lines = [
		'2026-10-29T17:59:00.000Z W [plugins] Native plugin hook skipped in Chat Bubbles: the JavaScript thread did not answer the layoutSubviews hook within 100 ms, so it did not run',
		'2026-10-29T18:00:01.000Z W [plugins] Native plugin hook skipped in Chat Bubbles: the JavaScript thread did not answer the setBackgroundColor: hook within 100 ms, so it did not run',
		'2026-10-29T18:00:02.000Z W [plugins] Native plugin hook skipped in Avatar Radius: the JavaScript thread did not answer the setFrame: hook within 100 ms, so it did not run',
	];

	expect([...parseSkippedHooks(lines, '2026-10-29T18:00:00.000Z')]).toEqual([
		['Chat Bubbles', ['setBackgroundColor:']],
		['Avatar Radius', ['setFrame:']],
	]);
});

test('attributes async native callback failures to their plugin', () => {
	const errors = parsePluginErrors(
		[
			'2026-10-29T18:00:01.000Z E [plugins] Native plugin callback failed in Avatar Radius: boom',
		],
		'2026-10-29T18:00:00.000Z',
	);

	expect([...errors]).toEqual([['Avatar Radius', ['boom']]]);
});

test('names the first frame outside the toast API as the caller', () => {
	expect(
		toastCaller(
			'Error\\n    at showToast (address at unbound:1:4)\\n    at anonymous (address at unbound:1:5)\\n    at copyLink (address at unbound:1:6)',
		),
	).toBe('copyLink');
	expect(toastCaller('Error\\n    at showToast (address at unbound:1:4)')).toBeUndefined();
});

test('counts a repeated hook failure as the same error', () => {
	const errors = parsePluginErrors(
		[
			'2026-10-29T18:00:01.000Z E [plugins] Native plugin hook failed in Avatar Radius: boom',
			'2026-10-29T18:00:11.000Z E [plugins] Native plugin hook failed in Avatar Radius: boom [repeated 40 times]',
		],
		'2026-10-29T18:00:00.000Z',
	);

	expect([...errors]).toEqual([['Avatar Radius', ['boom']]]);
});
