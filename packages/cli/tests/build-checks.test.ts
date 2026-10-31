import { afterEach, describe, expect, test } from 'bun:test';

import type { BuildCheck, BuildCheckIssue } from '../src/lib/build-checks';
import type { DiscoveredAddon } from '../src/lib/discovery';

import { createTempDir, runUbd, type TempDir } from './helpers/ubd';
import { buildWithChecks } from '../src/lib/build-checks';
import { discoverAddons } from '../src/lib/discovery';
import { loadWorkspace } from './helpers/config';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

function manifest(id: string, main: string): string {
	return JSON.stringify({ id, name: id, description: 'x', version: '1.0.0', main });
}

function workspace(build: string): TempDir {
	const dir = createTempDir({
		'unbound.config.json': JSON.stringify({ addons: ['addons/*'], build, output: 'dist' }),
		'addons/built/manifest.json': manifest('com.example.built', 'index.tsx'),
		'addons/built/package.json': JSON.stringify({ scripts: { build } }),
		'addons/built/index.tsx': 'export default {};',
		'addons/static/manifest.json': manifest('com.example.static', 'index.js'),
		'addons/static/index.js': 'module.exports = {};',
	});

	dirs.push(dir);

	return dir;
}

async function findAddon(dir: TempDir, id: string): Promise<DiscoveredAddon> {
	const addons = await discoverAddons(loadWorkspace(dir.path));
	const addon = addons.find((entry) => entry.id === id);

	if (!addon) {
		throw new Error(`${id} was not discovered.`);
	}

	return addon;
}

function reporting(issues: BuildCheckIssue[], seen: string[] = []): BuildCheck {
	return {
		name: 'fixture',
		run(addon) {
			seen.push(addon.id);

			return issues;
		},
	};
}

describe('buildWithChecks', () => {
	test('an error from a check fails the build', async () => {
		const addon = await findAddon(workspace('true'), 'com.example.built');
		const check = reporting([{ severity: 'error', message: 'broken layout' }]);

		expect(await buildWithChecks(addon, 'true', [check])).toBe(false);
	});

	test('a warning from a check does not fail the build', async () => {
		const addon = await findAddon(workspace('true'), 'com.example.built');
		const check = reporting([{ severity: 'warning', message: 'large media' }]);

		expect(await buildWithChecks(addon, 'true', [check])).toBe(true);
	});

	test('a check that throws fails the build', async () => {
		const addon = await findAddon(workspace('true'), 'com.example.built');
		const check: BuildCheck = {
			name: 'crashing',
			run() {
				throw new Error('boom');
			},
		};

		expect(await buildWithChecks(addon, 'true', [check])).toBe(false);
	});

	test('a static addon skips the bundle step but runs the checks', async () => {
		const addon = await findAddon(workspace('exit 1'), 'com.example.static');
		const seen: string[] = [];
		const check = reporting([{ severity: 'error', message: 'broken layout' }], seen);

		expect(addon.static).toBe(true);
		expect(await buildWithChecks(addon, 'exit 1', [check])).toBe(false);
		expect(seen).toEqual(['com.example.static']);
	});

	test('a failed bundle step skips the checks', async () => {
		const addon = await findAddon(workspace('exit 1'), 'com.example.built');
		const seen: string[] = [];

		expect(await buildWithChecks(addon, 'exit 1', [reporting([], seen)])).toBe(false);
		expect(seen).toEqual([]);
	});

	test('runs the checks in order', async () => {
		const addon = await findAddon(workspace('true'), 'com.example.built');
		const seen: string[] = [];
		const checks = ['first', 'second', 'third'].map((name) => ({
			name,
			run() {
				seen.push(name);

				return [];
			},
		}));

		expect(await buildWithChecks(addon, 'true', checks)).toBe(true);
		expect(seen).toEqual(['first', 'second', 'third']);
	});
});

describe('ubd build', () => {
	test('builds the built addon and checks the static one', async () => {
		const dir = workspace('true');
		const result = await runUbd(['build'], dir.path, {});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Building com.example.built…');
		expect(result.stdout).toContain('Checking com.example.static (static addon)…');
		expect(result.stdout).toContain('Built com.example.static.');
	});

	test('fails when the bundle step fails', async () => {
		const result = await runUbd(['build'], workspace('exit 1').path, {});

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Failed to build com.example.built.');
	});
});
