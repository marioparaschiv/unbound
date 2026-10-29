import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import type { PluginPushResult } from '@unbound-app/debugger-protocol';
import { describe, expect, test, afterEach, spyOn } from 'bun:test';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ReloadContext, BuiltAddon } from '../src/lib/reload-transport';

import { createReloadTransport, readBuiltAddon } from '../src/lib/reload-transport';

type RecordedPush = { addonId: string; bundle: string };

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function builtPlugin(): BuiltAddon {
	const dir = mkdtempSync(join(tmpdir(), 'ubd-push-'));

	roots.push(dir);

	const output = join(dir, 'dist');

	mkdirSync(output, { recursive: true });

	writeFileSync(
		join(dir, 'manifest.json'),
		JSON.stringify({
			id: 'com.example.sample',
			name: 'Sample',
			description: 'x',
			authors: [{ name: 'M', id: '1' }],
			version: '1.0.0',
			main: 'index.tsx',
		}),
	);

	writeFileSync(join(output, 'index.js'), 'module.exports = {};');

	return { id: 'com.example.sample', kind: 'plugin', dir, output, static: false };
}

type FakeClient = {
	isDeviceConnected: boolean;
	pushes: RecordedPush[];
	result: PluginPushResult;
};

function fakeContext(client: FakeClient): ReloadContext {
	return {
		client: {
			get isDeviceConnected() {
				return client.isDeviceConnected;
			},
			async pushPlugin(push) {
				client.pushes.push({ addonId: push.addonId, bundle: push.bundle });

				return client.result;
			},
		},
	};
}

const ok: PluginPushResult = { type: 'plugin-push-result', id: 'x', ok: true };

describe('createReloadTransport', () => {
	test('pushes the built bundle and manifest when the device is connected', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };

		const transport = createReloadTransport(fakeContext(client));

		await transport.reload(builtPlugin());

		expect(client.pushes).toHaveLength(1);
		expect(client.pushes[0]!.addonId).toBe('com.example.sample');
		expect(client.pushes[0]!.bundle).toBe('module.exports = {};');
	});

	test('reconnecting inside the wait window still pushes', async () => {
		const client: FakeClient = { isDeviceConnected: false, pushes: [], result: ok };

		// Simulate the device coming back shortly after the save, inside the reconnect window.
		setTimeout(() => void (client.isDeviceConnected = true), 60);

		const transport = createReloadTransport(fakeContext(client), 500);

		await transport.reload(builtPlugin());

		expect(client.pushes).toHaveLength(1);
	});

	test('a device that never reconnects warns and drops without pushing or throwing', async () => {
		const client: FakeClient = { isDeviceConnected: false, pushes: [], result: ok };

		const transport = createReloadTransport(fakeContext(client), 100);

		await transport.reload(builtPlugin());

		expect(client.pushes).toEqual([]);
	});

	test('a theme is skipped rather than pushed down the plugin channel', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };
		const plugin = builtPlugin();

		const transport = createReloadTransport(fakeContext(client));

		await transport.reload({ ...plugin, kind: 'theme' });

		expect(client.pushes).toEqual([]);
	});

	test('a missing build output is reported without throwing or crashing the watcher', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };
		const plugin = builtPlugin();

		const transport = createReloadTransport(fakeContext(client));

		// Point at an output directory that holds no built bundle; readBuiltAddon throws ENOENT, which
		// the transport must catch.
		await transport.reload({ ...plugin, output: join(plugin.dir, 'missing') });

		expect(client.pushes).toEqual([]);
	});

	test('a build that emits a differently-named bundle is reported with the expected path', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };
		const plugin = builtPlugin();

		// The transport expects `index.js` (from `main: index.tsx`); the build wrote `bundle.js` instead.
		rmSync(join(plugin.output, 'index.js'));
		writeFileSync(join(plugin.output, 'bundle.js'), 'module.exports = {};');

		const write = spyOn(process.stderr, 'write').mockImplementation(() => true);
		let errors = '';

		try {
			const transport = createReloadTransport(fakeContext(client));

			await transport.reload(plugin);

			errors = write.mock.calls.map(([chunk]) => String(chunk)).join('');
		} finally {
			write.mockRestore();
		}

		expect(client.pushes).toEqual([]);
		expect(errors).toContain(join(plugin.output, 'index.js'));
	});
});

describe('readBuiltAddon', () => {
	test('sends the bytecode built with the bundle and lists its digests in the manifest', () => {
		const plugin = builtPlugin();
		const compiled = Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0x01]);
		const bytecode = join(plugin.output, 'index.98.hbc');
		const bundle = join(plugin.output, 'index.js');

		writeFileSync(bytecode, compiled);
		utimesSync(bytecode, new Date(1_000_000), new Date(1_000_000));
		utimesSync(bundle, new Date(1_000_500), new Date(1_000_500));

		const built = readBuiltAddon(plugin);

		expect(built.bytecode).toEqual({ '98': compiled.toString('base64') });
		expect(built.manifest.bytecode).toEqual({
			'98': createHash('sha512').update(compiled).digest('hex'),
		});
	});

	test('leaves out bytecode from an earlier build', () => {
		const plugin = builtPlugin();
		const stale = join(plugin.output, 'index.98.hbc');

		writeFileSync(stale, 'old');
		utimesSync(stale, new Date(0), new Date(0));

		const built = readBuiltAddon(plugin);

		expect(built.bytecode).toBeUndefined();
		expect(built.manifest.bytecode).toBeUndefined();
	});
});
