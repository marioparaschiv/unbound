import type { AddonUpdate } from '@unbound-app/contracts/updates';
import { afterAll, beforeEach, expect, test } from 'bun:test';

import { FakeAddons, loadManagers, makeManifest, resetDevice, writes } from './helpers/addons';

Reflect.set(globalThis, '$$DEV$$', false);

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
		},
	});

	await plugins.delete(ID);
	writes.length = 0;
	await UpdatesStore.getState().applyAll();

	expect(plugins.getEntity(ID)).toBeUndefined();
	expect(writes).toEqual([]);
});

test('installs a listed release only when its bundle matches the digest', async () => {
	const manager = new FakeAddons();

	expect(await manager.applyRelease(ID, release('0'.repeat(64)))).toBe(false);
	expect(manager.getEntity(ID)).toBeUndefined();

	expect(await manager.applyRelease(ID, release(DIGEST))).toBe(true);
	expect(manager.getEntity(ID)?.version).toBe('1.1.0');
});
