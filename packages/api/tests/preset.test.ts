import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const fixture = join(import.meta.dir, 'fixtures', 'plugin');

async function run(command: string[]) {
	const child = Bun.spawn(command, {
		cwd: fixture,
		stdout: 'pipe',
		stderr: 'pipe',
		env: process.env,
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { code, output: stdout + stderr };
}

describe('the testing preset', () => {
	test('runs the fixture plugin tests with no setup beyond its bunfig.toml preload', async () => {
		const { code, output } = await run([process.execPath, 'test']);

		expect(output).toContain(' 0 fail');
		expect(output).toMatch(/\b12 pass\b/);
		expect(code).toBe(0);
	}, 30_000);

	test('types render, setLocale and the plugin modules from the fixture typings', async () => {
		const { code, output } = await run([process.execPath, 'x', 'tsc', '--noEmit', '-p', '.']);

		expect(output).toBe('');
		expect(code).toBe(0);
	}, 60_000);
});
