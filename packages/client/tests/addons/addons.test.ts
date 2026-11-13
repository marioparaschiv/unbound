import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AddonVersion } from '@unbound-app/contracts/addons';
import sha256 from '@unbound-app/utils/sha256';

import { CRASH_HOLDS_KEY, type CrashHolds } from '~/addons/crash-holds';

import {
	FakeAddons,
	installUnboundNative,
	makeManifest,
	resetDevice,
	states,
} from '../helpers/addons';

const ID = 'listed.example';

const server = Bun.serve({
	port: 0,
	fetch(request) {
		const [, version, file] = new URL(request.url).pathname.split('/');

		if (file === 'manifest.json') {
			return Response.json(makeManifest(ID, version));
		}

		return new Response(`bundle-${version}`);
	},
});

function listedVersion(version: string): AddonVersion {
	const base = `${server.url.origin}/${version}`;

	return {
		version,
		manifest: {
			id: ID,
			name: ID,
			description: 'test',
			authors: [{ name: 'Mario', id: '1' }],
			main: 'index.js',
			version,
			type: 'plugin',
		},
		changelog: null,
		changes: null,
		source: null,
		bundleSize: 1,
		sha256: sha256(`bundle-${version}`),
		publishedAt: '2024-01-01T00:00:00.000Z',
		manifestUrl: `${base}/manifest.json`,
		bundleUrl: `${base}/index.js`,
	};
}

/** A manager whose install requirements the test decides, recording each version they were asked for. */
class GatedAddons extends FakeAddons {
	requirementsMet = true;
	asked: string[] = [];

	protected override async installRequirements(version: AddonVersion): Promise<boolean> {
		this.asked.push(version.version);

		return this.requirementsMet;
	}

	/** Records crash holds as if a crash had disabled these addons. */
	holdCrashed(holds: CrashHolds) {
		this.settings.set(CRASH_HOLDS_KEY, holds);
	}
}

let manager: GatedAddons;

beforeEach(() => {
	resetDevice();
	installUnboundNative([]);

	manager = new GatedAddons();
});

afterAll(() => {
	server.stop(true);
});

describe('Addons.installListed', () => {
	test('a first install turns the addon on', async () => {
		expect(await manager.installListed({ id: ID }, listedVersion('1.0.0'))).toBe(true);

		expect(manager.getAddon(ID)?.version).toBe('1.0.0');
		expect(manager.isEnabled(ID)).toBe(true);
		expect(manager.getAddon(ID)?.started).toBe(true);
	});

	test('an update keeps the addon off when the user turned it off', async () => {
		await manager.installListed({ id: ID }, listedVersion('1.0.0'));
		manager.disable(ID);

		expect(await manager.installListed({ id: ID }, listedVersion('2.0.0'))).toBe(true);

		expect(manager.getAddon(ID)?.version).toBe('2.0.0');
		expect(manager.isEnabled(ID)).toBe(false);
	});

	test('an update turns back on an addon a crash disabled at its previous version', async () => {
		await manager.installListed({ id: ID }, listedVersion('1.0.0'));
		manager.disable(ID);
		manager.holdCrashed({ [ID]: '1.0.0' });

		expect(await manager.installListed({ id: ID }, listedVersion('2.0.0'))).toBe(true);

		expect(manager.isEnabled(ID)).toBe(true);
		expect(manager.getAddon(ID)?.started).toBe(true);
	});

	test('holds the version when asked, and a later install without a hold releases it', async () => {
		await manager.installListed({ id: ID }, listedVersion('1.0.0'), { hold: true });

		expect(manager.getHeldVersion(ID)).toBe('1.0.0');

		await manager.installListed({ id: ID }, listedVersion('2.0.0'));

		expect(manager.getHeldVersion(ID)).toBeUndefined();
	});

	test('installs nothing when its requirements are not met', async () => {
		manager.requirementsMet = false;

		expect(await manager.installListed({ id: ID }, listedVersion('1.0.0'))).toBe(false);

		expect(manager.asked).toEqual(['1.0.0']);
		expect(manager.getAddon(ID)).toBeUndefined();
		expect(states[ID]).toBeUndefined();
	});
});
