import { afterEach, describe, expect, test } from 'bun:test';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';

import { createTempDir, runUbd, type TempDir } from '../../helpers/ubd';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

function fakeAdbPath(): TempDir {
	const dir = createTempDir({
		adb: [
			'#!/bin/sh',
			`echo "$@" >> "$(dirname "$0")/calls"`,
			'case "$*" in',
			'  *get-state*) echo device ;;',
			'  *"date +%s"*) echo 1793050100 ;;',
			'  *pidof*) echo 100 ;;',
			"  *logcat*) echo '         1793050000.123  100  101 I Unbound: Loading bundle' ;;",
			'esac',
		].join('\n'),
	});

	chmodSync(join(dir.path, 'adb'), 0o755);
	dirs.push(dir);

	return dir;
}

describe('device logs command', () => {
	test('prints the history since a time and exits without --follow', async () => {
		const adb = fakeAdbPath();

		const result = await runUbd(['device', 'logs', '--since', '2m'], adb.path, {
			PATH: `${adb.path}:${process.env.PATH ?? ''}`,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Loading bundle');
		expect(result.stdout).toContain('-- End of the log. --');
		expect(await Bun.file(join(adb.path, 'calls')).text()).toContain('-T 1793049980.000 -d');
	}, 10_000);
});
