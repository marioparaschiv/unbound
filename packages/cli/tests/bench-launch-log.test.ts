import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseLaunchLog } from '../src/bench/launch-log';

// Loader logs recorded on the vphone by the earlier hand-run benches (unbound-lazy-eval, unbound-startup-bench).
function fixture(name: string): string {
	return readFileSync(join(import.meta.dir, 'fixtures/bench', name), 'utf8');
}

// Milliseconds after `RCTHost didInitializeRuntime reached.` at 03:43:57.021, read off the fixture's timestamps.
const WARM_MILESTONES = {
	pluginsRead: 39,
	bundleStart: 133,
	initStart: 158,
	pluginsStarted: 459,
	initialized: 460,
	bundleExecuted: 460,
	discordRun: 466,
};

describe('parseLaunchLog', () => {
	test('reads every milestone of a warm launch relative to the runtime', () => {
		const log = parseLaunchLog(fixture('warm-launch.log'));

		expect(log.runtimeEpochMs).toBe(Date.parse('2026-11-01T03:43:57.021Z'));
		expect(log.milestones).toEqual(WARM_MILESTONES);
		expect(log.missing).toEqual([]);
	});

	test('lists error lines without invalidating the launch', () => {
		const log = parseLaunchLog(fixture('warm-launch.log'));

		expect(log.failures).toHaveLength(1);
		expect(log.failures[0]).toStartWith(
			"[console] '»', '[Themes]', 'Failed to load addon local--adda99dac9ad4b49:'",
		);
	});

	test('reads only the last launch when a rotated log holds an earlier one', () => {
		expect(parseLaunchLog(fixture('rotated-launches.log')).milestones).toEqual(WARM_MILESTONES);
	});

	test('names the milestones a launch that died early never reached', () => {
		const log = parseLaunchLog(fixture('crashed-launch.log'));

		expect(log.missing).toEqual(['bundleExecuted', 'initialized']);
		expect(log.milestones.bundleStart).toBe(79);
	});

	test('treats a log without the runtime line as missing every required milestone', () => {
		const log = parseLaunchLog(
			"2026-11-01T03:43:57.481Z I [console] '»', '[Core]', 'Unbound initialized'\n",
		);

		expect(log.runtimeEpochMs).toBeUndefined();
		expect(log.missing).toEqual(['bundleExecuted', 'initialized']);
	});

	test('does not mistake "Unbound already initialized" for initialization', () => {
		const text =
			fixture('crashed-launch.log') +
			"2026-11-01T01:42:19.300Z W [console] '»', '[Core]', 'Unbound already initialized'\n";

		expect(parseLaunchLog(text).milestones.initialized).toBeUndefined();
	});
});
