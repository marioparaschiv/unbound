import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import type { EnvSource } from '../../src/lib/env';

export type UbdResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

export type TempDir = {
	path: string;
	/** Deletes the directory. */
	remove: () => void;
};

const ENTRY = join(import.meta.dir, '..', '..', 'src', 'index.ts');

/**
 * @description Runs the real `ubd` entry point in a child process.
 * @param args The command line arguments.
 * @param cwd The working directory.
 * @param env Variables to set on top of the parent's environment.
 * @returns The exit code and output.
 */
export async function runUbd(args: string[], cwd: string, env: EnvSource): Promise<UbdResult> {
	const child = Bun.spawn([process.execPath, ENTRY, ...args], {
		cwd,
		env: { ...process.env, NO_COLOR: '1', ...env },
		stdout: 'pipe',
		stderr: 'pipe',
	});

	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	return { exitCode, stdout, stderr };
}

const BUILD_PROGRESS = /^(Building|Checking|Built) .*\n/gm;

/**
 * @description Drops the progress lines `ubd build` prints on stderr, leaving its warnings and errors.
 * @param stderr The command's stderr.
 * @returns The stderr without progress lines.
 */
export function withoutProgress(stderr: string): string {
	return stderr.replace(BUILD_PROGRESS, '');
}

/**
 * @description Creates a temporary directory holding the given files.
 * @param files File contents by path relative to the directory.
 * @returns The directory and a function that deletes it.
 */
export function createTempDir(files: Record<string, string> = {}): TempDir {
	const path = mkdtempSync(join(tmpdir(), 'ubd-test-'));

	for (const [name, content] of Object.entries(files)) {
		mkdirSync(dirname(join(path, name)), { recursive: true });
		writeFileSync(join(path, name), content);
	}

	return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}
