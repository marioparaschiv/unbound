import { afterEach, beforeEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DeviceDropped } from '~/device-bridge';
import { relaunchCommands } from '~/device-drops';
import { runDevice, type DeviceRun } from '~/device-run';
import {
	cycleScript,
	developerModeScript,
	MATRIX_TOAST_MS,
	pluginLogScript,
	pluginsSettledScript,
	redrawTimesScript,
	selfTestsScript,
	toastDurationScript,
	toastLogScript,
	type CycleResult,
} from '~/device-scripts';
import { settingsScreenScript } from '~/settings-scripts';
import { deviceEnvironmentScript } from '~/environment';
import {
	selfTestCancellationScript,
	selfTestFinishScript,
	selfTestFiredScript,
	selfTestStartScript,
} from '~/loader-self-test';
import { COLLECT_GARBAGE_SCRIPT } from '~/matrix-cycles';
import { fakeMatrixDevice, type FakeAnswer } from './helpers/device-fakes';

const catalog = [
	{ id: 'unbound.alpha', name: 'Alpha' },
	{ id: 'unbound.beta', name: 'Beta' },
];

let out: string;

beforeEach(() => {
	out = mkdtempSync(join(tmpdir(), 'device-run-'));
});

afterEach(() => {
	rmSync(out, { recursive: true, force: true });
});

function cycled(id: string): string {
	const result: CycleResult = {
		id,
		installed: true,
		wasStarted: true,
		error: '',
		restarted: true,
		updateError: '',
		updated: true,
		hooksBefore: 3,
		hooksStopped: 0,
		hooksAfter: 3,
		hooksUpdated: 3,
	};

	return JSON.stringify(result);
}

/** A healthy Android device: the self-test passes through Alpha and both plugins cycle cleanly. */
function healthyAnswers(): Map<string, FakeAnswer> {
	const selfTestError = () =>
		JSON.stringify([
			`${new Date().toISOString()} E [plugins] Native plugin hook failed in Alpha: loader self-test`,
		]);

	return new Map<string, FakeAnswer>([
		[developerModeScript(false), 'false'],
		[developerModeScript(true), 'false'],
		[toastDurationScript(MATRIX_TOAST_MS), 'null'],
		[toastDurationScript(null), '300'],
		[
			deviceEnvironmentScript(),
			JSON.stringify({
				loader: '1.0.0',
				origin: 'app.unbound.android',
				client: 'c',
				discord: '1+2',
			}),
		],
		[selfTestStartScript(), 'Alpha'],
		[selfTestFiredScript(), 'fired'],
		[
			selfTestFinishScript(),
			JSON.stringify({ host: 'Alpha', platform: 'android', base: 2, derived: 0 }),
		],
		[
			selfTestCancellationScript(),
			JSON.stringify({ host: 'Alpha', cancellations: { cancelled: 'cancellation' } }),
		],
		[pluginLogScript(), selfTestError],
		...catalog.flatMap(({ id }): [string, FakeAnswer][] => [
			[cycleScript(id), cycled(id)],
			[settingsScreenScript(id), 'none'],
		]),
		[COLLECT_GARBAGE_SCRIPT, 'collected'],
		[redrawTimesScript(2_000), JSON.stringify({ 'unbound.alpha': 120 })],
		[selfTestsScript(), '{}'],
		[toastLogScript(), '[]'],
		[pluginsSettledScript(), 'settled'],
	]);
}

function report(): DeviceRun {
	return JSON.parse(readFileSync(join(out, 'run.json'), 'utf8'));
}

test('runs the matrix on a device and writes its report', async () => {
	const { device, evaluated } = fakeMatrixDevice(healthyAnswers());
	const run = await runDevice(device, { out, catalog, log: () => {} });

	expect(run.error).toBeUndefined();
	expect(run.device).toEqual({ name: 'Fake Phone' });
	expect(run.selfTest).toMatchObject({ ok: true });
	expect(run.checks.map((check) => [check.id, check.behavior, check.lifecycle])).toEqual([
		['unbound.alpha', 'pass', 'pass'],
		['unbound.beta', 'pass', 'pass'],
	]);
	expect(run.checks[0]!.redrawMs).toBe(120);
	expect(run.drops).toEqual([]);
	expect(run.memory?.relaunched).toBe(false);
	expect(report()).toEqual(JSON.parse(JSON.stringify(run)));
	expect(existsSync(join(out, 'results.json'))).toBe(true);
	expect(existsSync(join(out, 'matrix.md'))).toBe(true);
	// Developer mode was off, so the run turns it off again and puts the toast duration back.
	expect(evaluated.slice(-2)).toEqual([developerModeScript(false), toastDurationScript(null)]);
});

test('relaunches Discord when the device drops during a plugin cycle and measures it again', async () => {
	const answers = healthyAnswers();
	let drops = 1;

	answers.set(cycleScript('unbound.beta'), () => {
		if (drops-- > 0) throw new DeviceDropped('device-disconnected', 'Device disconnected');

		return cycled('unbound.beta');
	});

	const { device, commands } = fakeMatrixDevice(answers);
	const run = await runDevice(device, { out, catalog, log: () => {} });

	expect(run.error).toBeUndefined();
	expect(run.drops).toEqual([
		'unbound.beta: Discord stopped answering, and no crash or memory report explains it',
	]);
	expect(run.memory?.relaunched).toBe(true);
	expect(commands).toContainEqual(relaunchCommands(device.target)[0]!);
	expect(run.checks.find((check) => check.id === 'unbound.beta')?.behavior).toBe('pass');
	expect(report().drops).toEqual(run.drops);
});

test('keeps the checks measured before a failure, reports it and restores the device', async () => {
	const answers = healthyAnswers();

	answers.set(selfTestsScript(), () => {
		throw new Error('Evaluation failed: "TypeError"');
	});

	const { device, evaluated } = fakeMatrixDevice(answers);
	const run = await runDevice(device, { out, catalog, log: () => {} });

	expect(run.error).toBe('run failed: Evaluation failed: "TypeError"');
	expect(run.checks.map((check) => check.id)).toEqual(['unbound.alpha', 'unbound.beta']);
	expect(report().error).toBe(run.error);
	expect(evaluated.slice(-2)).toEqual([developerModeScript(false), toastDurationScript(null)]);
});
