import type { PluginPushResult } from '@unbound-app/debugger-protocol';
import { describe, expect, test, afterEach, spyOn } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import type { PushedManifest } from '@unbound-app/types';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createReloadTransport, type ReloadContext } from '~/lib/reload-transport';

import { builtPlugin as makeBuiltPlugin, writeBuiltManifest } from '../helpers/built-plugin';

type RecordedPush = {
	addonId: string;
	kind?: string;
	bundle: string;
	manifest: PushedManifest;
};

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const builtPlugin = () => makeBuiltPlugin(roots);

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
				client.pushes.push({
					addonId: push.addonId,
					kind: push.kind,
					bundle: push.bundle,
					manifest: push.manifest,
				});

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

	test('pushes the manifest the build wrote into the output', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };
		const plugin = builtPlugin();

		writeBuiltManifest(plugin, { capabilities: ['native.objc.invoke'] });

		await createReloadTransport(fakeContext(client)).reload(plugin);

		expect(client.pushes[0]!.manifest).toMatchObject({
			main: 'index.js',
			capabilities: ['native.objc.invoke'],
		});
	});

	test('pushes the source manifest when the build wrote none', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };

		await createReloadTransport(fakeContext(client)).reload(builtPlugin());

		expect(client.pushes[0]!.manifest).toMatchObject({ main: 'index.tsx' });
		expect(client.pushes[0]!.manifest).not.toHaveProperty('capabilities');
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

	test('a static theme is pushed as-is, tagged for the themes manager', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };
		const dir = mkdtempSync(join(tmpdir(), 'ubd-push-theme-'));
		const bundle = JSON.stringify({
			type: 'dark',
			semantic: {},
			raw: { BRAND_500: '#c2789b' },
		});

		roots.push(dir);
		writeFileSync(
			join(dir, 'manifest.json'),
			JSON.stringify({
				id: 'com.example.theme',
				name: 'Theme',
				description: 'x',
				authors: [{ name: 'M', id: '1' }],
				version: '1.0.0',
				main: 'bundle.json',
			}),
		);
		writeFileSync(join(dir, 'bundle.json'), bundle);

		const transport = createReloadTransport(fakeContext(client));

		await transport.reload({
			id: 'com.example.theme',
			kind: 'theme',
			dir,
			output: dir,
			static: true,
		});

		expect(client.pushes).toHaveLength(1);
		expect(client.pushes[0]).toMatchObject({
			addonId: 'com.example.theme',
			kind: 'theme',
			bundle,
		});
	});

	test('a missing build output is reported without throwing or crashing the watcher', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };
		const plugin = builtPlugin();

		const transport = createReloadTransport(fakeContext(client));

		// Point at an output directory that holds no built bundle; reading it fails, which
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

	test('an invalid manifest is reported and never pushed', async () => {
		const client: FakeClient = { isDeviceConnected: true, pushes: [], result: ok };
		const plugin = builtPlugin();

		writeFileSync(
			join(plugin.dir, 'manifest.json'),
			JSON.stringify({ id: 'com.example.sample' }),
		);

		const write = spyOn(process.stderr, 'write').mockImplementation(() => true);
		let errors = '';

		try {
			await createReloadTransport(fakeContext(client)).reload(plugin);

			errors = write.mock.calls.map(([chunk]) => String(chunk)).join('');
		} finally {
			write.mockRestore();
		}

		expect(client.pushes).toEqual([]);
		expect(errors).toContain(`Invalid ${join(plugin.dir, 'manifest.json')}`);
	});
});
