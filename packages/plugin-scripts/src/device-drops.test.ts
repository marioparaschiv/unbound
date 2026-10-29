import { expect, test } from 'bun:test';

import {
	dropBaseline,
	dropReason,
	parseJetsamKills,
	parseLatestExit,
	relaunchCommands,
	type CommandRunner,
} from './device-drops';

const jetsam = `{"bug_type":"298"}
${JSON.stringify({
	processes: [
		{ name: 'SpringBoard', rpages: 86400, reason: 'highwater' },
		{ name: 'Discord', rpages: 20012 },
	],
})}`;

const exitInfo = `ACTIVITY MANAGER PROCESS EXIT INFO (dumpsys activity exit-info)
        ApplicationExitInfo #0:
          timestamp=2026-10-29 22:14:35.381 pid=14092 realUid=10208
          process=com.discord reason=3 (LOW MEMORY) subreason=0 (UNKNOWN) status=0
        ApplicationExitInfo #1:
          timestamp=2026-10-29 21:51:44.059 pid=13350 realUid=10208
          process=com.discord reason=10 (USER REQUESTED) subreason=21 (FORCE STOP) status=0`;

function shell(output: string) {
	return { ok: true, stdout: JSON.stringify({ output }) };
}

test('names the processes a jetsam report killed', () => {
	expect(parseJetsamKills(jetsam)).toEqual(['SpringBoard (highwater, 1350 MB)']);
	expect(parseJetsamKills('not a report')).toEqual([]);
});

test('reads the newest Android exit record', () => {
	expect(parseLatestExit(exitInfo)).toEqual({
		timestamp: '2026-10-29 22:14:35.381',
		reason: 'LOW MEMORY',
	});
	expect(parseLatestExit('')).toBeUndefined();
});

test('explains an iOS drop by the jetsam report that appeared since the baseline', async () => {
	let files = 'Discord-2026-10-28.ips\n';
	const run: CommandRunner = async (command) => {
		const line = command.at(-1)!;

		return line.startsWith('cat ') ? shell(jetsam) : shell(files);
	};
	const target = { kind: 'ios', udid: 'abc' } as const;
	const baseline = await dropBaseline(target, run);

	expect(await dropReason(target, baseline, run)).toBeUndefined();

	files += 'JetsamEvent-2026-10-29-221629.ips\n';

	expect(await dropReason(target, baseline, run)).toBe(
		'jetsam killed SpringBoard (highwater, 1350 MB)',
	);
});

test('explains an Android drop by a new exit record', async () => {
	let output = exitInfo.replace('22:14:35.381', '22:00:00.000');
	const run: CommandRunner = async () => ({ ok: true, stdout: output });
	const target = { kind: 'android', serial: 'emulator-5554' } as const;
	const baseline = await dropBaseline(target, run);

	expect(await dropReason(target, baseline, run)).toBeUndefined();

	output = exitInfo;

	expect(await dropReason(target, baseline, run)).toBe(
		'Discord exited (low memory at 2026-10-29 22:14:35.381)',
	);
});

test('relaunches Discord on each platform', () => {
	expect(relaunchCommands({ kind: 'android', serial: 'emulator-5554' })[0]).toContain('monkey');
	expect(relaunchCommands({ kind: 'ios', udid: 'abc' }).map((command) => command[1])).toEqual([
		'ui_action',
		'shell_exec',
	]);
});
