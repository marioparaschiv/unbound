import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DiscoveredAddon } from '../src/lib/discovery';

import { formatDuration, runCommand } from '../src/lib/run-command';
import { buildAddon } from '../src/lib/build-addon';

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);

		return true;
	} catch {
		return false;
	}
}

async function waitForPid(file: string): Promise<number> {
	for (let attempt = 0; attempt < 100; attempt++) {
		const pid = Number.parseInt(readFileSafe(file), 10);

		if (pid > 0) {
			return pid;
		}

		await Bun.sleep(20);
	}

	throw new Error(`${file} never received a pid.`);
}

function readFileSafe(file: string): string {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

async function waitForExit(pid: number): Promise<boolean> {
	for (let attempt = 0; attempt < 50 && isAlive(pid); attempt++) {
		await Bun.sleep(20);
	}

	return !isAlive(pid);
}

function grandchildScript(pidFile: string): string {
	return `sh -c 'sleep 30 & echo $! > ${pidFile}; wait'; sleep 30`;
}

describe('runCommand', () => {
	test('captures the output of a clean exit', async () => {
		expect(await runCommand('sh', ['-c', 'echo hello'], 5_000)).toEqual({
			ok: true,
			stdout: 'hello\n',
		});
	});

	test('reports a failing exit with its output', async () => {
		const result = await runCommand('sh', ['-c', 'echo broken >&2; exit 3'], 5_000);

		expect(result).toEqual({ ok: false, error: 'sh failed: broken' });
	});

	test('kills a program that outlives its timeout', async () => {
		const started = Date.now();
		const result = await runCommand('sleep', ['10'], 100);

		expect(result).toEqual({ ok: false, error: 'sleep 10 timed out after 100ms.' });
		expect(Date.now() - started).toBeLessThan(2_000);
	});

	test('kills the processes a timed-out program forked', async () => {
		const directory = mkdtempSync(join(tmpdir(), 'ubd-run-command-'));
		const pidFile = join(directory, 'grandchild.pid');

		try {
			const running = runCommand('sh', ['-c', grandchildScript(pidFile)], 1_000);
			const grandchild = await waitForPid(pidFile);

			expect(isAlive(grandchild)).toBe(true);
			expect((await running).ok).toBe(false);
			expect(await waitForExit(grandchild)).toBe(true);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	test('resolves when the program exits even though a forked child keeps its output open', async () => {
		const started = Date.now();
		const result = await runCommand('sh', ['-c', '(sleep 5 &) ; echo started'], 4_000);

		expect(result).toEqual({ ok: true, stdout: 'started\n' });
		expect(Date.now() - started).toBeLessThan(3_000);
	});

	test('names the subcommand after any leading flags', async () => {
		const result = await runCommand('sh', ['-c', 'exit 4', 'get-state'], 5_000);

		expect(result).toEqual({ ok: false, error: 'sh get-state exited with code 4.' });
	});

	test('explains a program that is not installed', async () => {
		const result = await runCommand('ubd-missing-binary', [], 1_000);

		expect(result).toEqual({
			ok: false,
			error: 'ubd-missing-binary was not found. Install it or add it to your PATH.',
		});
	});
});

describe('buildAddon', () => {
	test('kills every process of a build that times out', async () => {
		const directory = mkdtempSync(join(tmpdir(), 'ubd-build-addon-'));
		const pidFile = join(directory, 'grandchild.pid');
		const addon = {
			id: 'com.example.slow',
			dir: directory,
			output: directory,
			static: false,
		} as DiscoveredAddon;

		try {
			const building = buildAddon(addon, grandchildScript(pidFile), {}, 1_000);
			const grandchild = await waitForPid(pidFile);

			expect(isAlive(grandchild)).toBe(true);
			expect(await building).toBe(false);
			expect(await waitForExit(grandchild)).toBe(true);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});

describe('formatDuration', () => {
	test('uses seconds for whole seconds and milliseconds otherwise', () => {
		expect(formatDuration(60_000)).toBe('60s');
		expect(formatDuration(1_500)).toBe('1500ms');
		expect(formatDuration(100)).toBe('100ms');
	});
});
