import { describe, expect, test } from 'bun:test';

import { formatDuration, runCommand } from '../src/lib/run-command';

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

describe('formatDuration', () => {
	test('uses seconds for whole seconds and milliseconds otherwise', () => {
		expect(formatDuration(60_000)).toBe('60s');
		expect(formatDuration(1_500)).toBe('1500ms');
		expect(formatDuration(100)).toBe('100ms');
	});
});
