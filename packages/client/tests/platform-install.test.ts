import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AddonManifest } from '@unbound-app/types';

import { FakeAddons, makeManifest, resetDevice, writes } from './helpers/addons';

const { NativePluginUnsupportedPlatformError } = await import('~/native/errors');

const ID = 'platform.example';

let served: AddonManifest = makeManifest(ID);

const server = Bun.serve({
	port: 0,
	fetch(request) {
		return new URL(request.url).pathname.endsWith('/manifest.json')
			? Response.json(served)
			: new Response('({})');
	},
});

const manifestUrl = `${server.url.origin}/${ID}/manifest.json`;

function runOn(platform: string) {
	Object.defineProperty(globalThis, 'NativePlatform', {
		configurable: true,
		writable: true,
		value: {
			platform,
			device: { platform },
			addons: { verify: () => ({ status: 'unsigned' }) },
		},
	});
}

async function install() {
	const manager = new FakeAddons();
	const errors: Error[] = [];

	manager.on('install-error', (error) => void errors.push(error));

	return { installed: await manager.install(manifestUrl), errors };
}

beforeEach(() => {
	resetDevice();
});

afterEach(() => {
	globalThis.NativePlatform = undefined;
});

afterAll(() => {
	server.stop(true);
});

describe('installing an addon', () => {
	test('refuses a platform its platforms object leaves out', async () => {
		served = { ...makeManifest(ID), platforms: { ios: {} } };
		runOn('android');

		const { installed, errors } = await install();

		expect(installed).toBeUndefined();
		expect(errors[0]).toBeInstanceOf(NativePluginUnsupportedPlatformError);
		expect(writes).toEqual([]);
	});

	test('refuses a platform its older platforms list leaves out', async () => {
		served = { ...makeManifest(ID), platforms: ['ios'] };
		runOn('android');

		const { installed, errors } = await install();

		expect(installed).toBeUndefined();
		expect(errors[0]).toBeInstanceOf(NativePluginUnsupportedPlatformError);
	});

	test('installs on a platform it lists', async () => {
		served = { ...makeManifest(ID), platforms: { ios: {} } };
		runOn('ios');

		const { installed, errors } = await install();

		expect(errors).toEqual([]);
		expect(installed?.id).toBe(ID);
	});
});
