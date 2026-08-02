import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import type { PluginPushResult } from '@unbound-app/debugger-protocol';
import { describe, expect, test, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ReloadContext, BuiltAddon } from '../src/lib/reload-transport';

import { createReloadTransport } from '../src/lib/reload-transport';

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

		const errors: string[] = [];
		const original = process.stderr.write.bind(process.stderr);
		process.stderr.write = ((chunk: any) => void errors.push(String(chunk))) as any;

		try {
			const transport = createReloadTransport(fakeContext(client));
			await transport.reload(plugin);
		} finally {
			process.stderr.write = original;
		}

		expect(client.pushes).toEqual([]);
		expect(errors.join('')).toContain(join(plugin.output, 'index.js'));
	});
});
