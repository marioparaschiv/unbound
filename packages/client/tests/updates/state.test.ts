import type { AddonUpdate } from '@unbound-app/contracts/updates';
import { afterAll, beforeEach, expect, test } from 'bun:test';

import { FakeAddons, loadManagers, makeManifest, resetDevice, writes } from '../helpers/addons';

const Manager = await loadManagers();
const { default: UpdatesStore } = await import('~/updates/state');

const ID = 'dev.updated';
const BUNDLE = 'module.exports = {};';

const releaseServer = Bun.serve({
	port: 0,
	fetch(request) {
		const { pathname } = new URL(request.url);

		if (pathname.endsWith('/manifest.json')) {
			return Response.json(makeManifest(ID, '1.1.0'));
		}

		return new Response(BUNDLE);
	},
});

afterAll(() => {
	releaseServer.stop(true);
});

function release(sha256: string): AddonUpdate {
	return {
		id: ID,
		version: '1.1.0',
		reason: 'newer',
		manifestUrl: `${releaseServer.url.origin}/${ID}/1.1.0/manifest.json`,
		bundleUrl: `${releaseServer.url.origin}/${ID}/1.1.0/index.js`,
		sha256,
		changelog: null,
		changes: null,
		changelogs: [],
	};
}

const DIGEST = new Bun.CryptoHasher('sha256').update(BUNDLE).digest('hex');

beforeEach(() => {
	resetDevice();
});

test('leaves an addon deleted after the update check deleted when updates apply', async () => {
	const plugins = Manager.for('plugin');

	plugins.load('module.exports = {};', makeManifest(ID));
	UpdatesStore.setState({
		state: {
			status: 'ready',
			checkedAt: new Date().toISOString(),
			updates: [{ kind: 'plugin', id: ID, name: ID, from: '1.0.0', update: release(DIGEST) }],
			loader: null,
			requiredLoader: null,
			discord: null,
			client: 'current',
		},
	});

	await plugins.uninstall(ID);
	writes.length = 0;
	await UpdatesStore.getState().applyAll();

	expect(plugins.getAddon(ID)).toBeUndefined();
	expect(writes).toEqual([]);
});

test('stages the client update the loader downloads, and keeps it available when that fails', async () => {
	const outcomes = [() => Promise.reject(new Error('offline')), async () => true];

	globalThis.UnboundNative = {
		getLoader: () => ({ origin: 'test', version: '2.0.0', bytecodeVersion: 96 }),
		getPlugins: () => [],
		getThemes: () => [],
		getSha256: () => 'native',
		downloadFile: async () => undefined,
		updateBundle: () => (outcomes.shift() ?? (async () => false))(),
	};
	UpdatesStore.setState({
		state: {
			status: 'ready',
			checkedAt: new Date().toISOString(),
			updates: [],
			loader: null,
			requiredLoader: null,
			discord: null,
			client: 'available',
		},
		applying: {},
	});

	try {
		expect(await UpdatesStore.getState().applyClient()).toBe(false);
		expect(UpdatesStore.getState().applying['unbound::client']).toBe('failed');

		expect(await UpdatesStore.getState().applyClient()).toBe(true);
		expect(UpdatesStore.getState().applying['unbound::client']).toBeUndefined();
		expect(UpdatesStore.getState().state).toMatchObject({ client: 'staged' });

		// Nothing newer came, so the row shows the client as current rather than a failure.
		UpdatesStore.setState((prev) =>
			prev.state.status === 'ready' ? { state: { ...prev.state, client: 'available' } } : {},
		);
		expect(await UpdatesStore.getState().applyClient()).toBe(false);
		expect(UpdatesStore.getState().applying['unbound::client']).toBeUndefined();
		expect(UpdatesStore.getState().state).toMatchObject({ client: 'current' });
	} finally {
		globalThis.UnboundNative = undefined;
	}
});

test('installs a listed release only when its bundle matches the digest', async () => {
	const manager = new FakeAddons();

	expect(await manager.applyRelease(ID, release('0'.repeat(64)))).toBe(false);
	expect(manager.getAddon(ID)).toBeUndefined();

	expect(await manager.applyRelease(ID, release(DIGEST))).toBe(true);
	expect(manager.getAddon(ID)?.version).toBe('1.1.0');
});
