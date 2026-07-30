import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { describe, expect, test, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ReloadTransport, BuiltAddon } from '../src/lib/reload-transport';

import { DevServer } from '../src/lib/dev-server';
import { loadConfig } from '../src/lib/config';

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Builds a workspace root holding one plugin whose `build` command is caller-controlled. */
function workspace(build: string): string {
	const root = mkdtempSync(join(tmpdir(), 'ubd-dev-'));
	roots.push(root);

	writeFileSync(
		join(root, 'unbound.config.json'),
		JSON.stringify({ addons: ['plugins/*'], build, output: 'dist' }),
	);

	const pluginDir = join(root, 'plugins', 'sample');
	mkdirSync(join(pluginDir, 'dist'), { recursive: true });

	writeFileSync(
		join(pluginDir, 'manifest.json'),
		JSON.stringify({
			id: 'com.example.sample',
			name: 'Sample',
			description: 'x',
			authors: [{ name: 'M', id: '1' }],
			version: '1.0.0',
			main: 'index.tsx',
		}),
	);

	// A package.json with a build script marks the addon non-static, so the build command runs.
	writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({ scripts: { build } }));
	writeFileSync(join(pluginDir, 'index.tsx'), 'export default {};');
	writeFileSync(join(pluginDir, 'dist', 'index.js'), 'module.exports = {};');

	return root;
}

/** A transport that records every addon handed to it, so a test can assert whether push happened. */
function recordingTransport(): ReloadTransport & { calls: BuiltAddon[] } {
	const calls: BuiltAddon[] = [];

	return {
		calls,
		async reload(addon: BuiltAddon) {
			calls.push(addon);
		},
	};
}

describe('DevServer build-failure isolation', () => {
	test('a failing build never reaches the transport', async () => {
		const resolved = loadConfig(workspace('exit 1'));
		const transport = recordingTransport();
		const server = new DevServer(resolved, transport);

		await server.start();
		server.stop();

		expect(transport.calls).toEqual([]);
	});

	test('a passing build reaches the transport once per addon', async () => {
		const resolved = loadConfig(workspace('true'));
		const transport = recordingTransport();
		const server = new DevServer(resolved, transport);

		await server.start();
		server.stop();

		expect(transport.calls.map((addon) => addon.id)).toEqual(['com.example.sample']);
	});
});

describe('DevServer rebuild debounce', () => {
	// A single rebuild pass builds each discovered addon exactly once; the per-addon debounce map
	// coalesces bursts so a run never fans out into multiple rebuilds of the same addon.
	test('the initial pass rebuilds each addon exactly once', async () => {
		const resolved = loadConfig(workspace('true'));
		const transport = recordingTransport();
		const server = new DevServer(resolved, transport);

		await server.start();
		server.stop();

		const ids = transport.calls.map((addon) => addon.id);
		expect(ids).toEqual(['com.example.sample']);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
