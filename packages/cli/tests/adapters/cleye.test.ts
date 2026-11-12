import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { failureJson } from '~/adapters/cleye';

const PROBE = join(import.meta.dir, '..', 'helpers', 'cleye-command.ts');

async function probe(args: string[], env: Record<string, string> = {}) {
	const child = Bun.spawn([process.execPath, PROBE, 'probe', ...args], {
		env: { ...process.env, NO_COLOR: '1', ...env },
		stdin: 'pipe',
		stdout: 'pipe',
		stderr: 'pipe',
	});

	child.stdin.end();

	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	return { exitCode, stdout, stderr };
}

describe('--json output', () => {
	test('prints success data unchanged', async () => {
		const result = await probe(['ok', '--json']);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({ count: 1 });
	});

	test('prints a coded failure with its hint and field', async () => {
		const result = await probe(['coded', '--json']);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.stdout)).toEqual({
			ok: false,
			text: 'No addon is named x.',
			error: {
				code: 'not-found',
				message: 'No addon is named x.',
				hint: 'Run ubd build.',
				field: 'code',
			},
		});
	});

	test('names a failure without a code command-failed', async () => {
		const result = await probe(['plain', '--json']);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.stdout).error).toEqual({
			code: 'command-failed',
			message: 'It broke.',
		});
	});

	test('turns a throw into command-failed with its stack', async () => {
		const result = await probe(['throws', '--json']);

		expect(result.exitCode).toBe(1);
		expect(JSON.parse(result.stdout).error).toMatchObject({
			code: 'command-failed',
			message: 'Boom.',
			stack: expect.stringContaining('Boom.'),
		});
	});

	test('reports a schema error as invalid-input on the field, exiting 2', async () => {
		const result = await probe(['ok', '--count=0', '--json']);

		expect(result.exitCode).toBe(2);
		expect(result.stderr).toBe('');
		expect(JSON.parse(result.stdout).error).toEqual({
			code: 'invalid-input',
			message: 'must be >= 1 (at /count)',
			field: 'count',
		});
	});

	test('reports a missing stdin argument as invalid-input, exiting 2', async () => {
		const result = await probe(['--json'], { UBD_TEST_TTY: '1' });

		expect(result.exitCode).toBe(2);
		expect(JSON.parse(result.stdout).error).toEqual({
			code: 'invalid-input',
			message: 'Missing required argument: code.',
			field: 'code',
		});
	});
});

describe('plain output', () => {
	test('prints input errors as text on stderr', async () => {
		const result = await probe(['ok', '--count=0']);

		expect(result.exitCode).toBe(2);
		expect(result.stdout).toBe('');
		expect(result.stderr).toBe('must be >= 1 (at /count)\n');
	});

	test('prints a failure as its text on stderr', async () => {
		const result = await probe(['coded']);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBe('No addon is named x.\n');
	});
});

describe('failureJson', () => {
	const error = { code: 'timeout', message: 'Timed out.' } as const;

	test('adds the error to object data that has none', () => {
		expect(failureJson({ ok: false, text: '1 error.', data: { errors: 1 }, error })).toEqual({
			errors: 1,
			error,
		});
	});

	test('keeps data that has its own error, or is not an object, as it was', () => {
		const result = { ok: false, error: 'Timed out.', code: 'timeout' };

		expect(failureJson({ ok: false, text: 'x', data: result, error })).toBe(result);
		expect(failureJson({ ok: false, text: 'x', data: [1], error })).toEqual([1]);
	});
});
