import {
	checkUpdatesEndpoint,
	MAINTENANCE_URL,
	createTestContext,
	manifest,
	seedApprovedAddon,
	seedVersion,
	serveEndpoints,
	signInWithDiscord,
} from '@unbound-app/web/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { updatesRequestSchema } from '@unbound-app/contracts/updates';
import type { TestContext } from '@unbound-app/web/testing';
import type { Addon } from '@unbound-app/types';

import { applyUpdate, fetchUpdates, listInstalled, reinstallFromStore } from '~/lib/updates';
import type { InstalledEntry, PendingUpdate, UpdatableKind } from '~/lib/updates';

import {
	FakeAddons,
	existingFiles,
	makeInstance,
	makeManifest,
	resetDevice,
	writes,
} from './helpers/addons';

const CLIENT_VERSION = '1.0.0';

// `ManagerKind` lives beside build-time tokens that only exist in a client bundle.
const PLUGINS: UpdatableKind = 0;

// The CDN: real bytes over HTTP, keyed by path, standing in for the public bucket.
const files = new Map<string, string>();
const cdn = Bun.serve({
	port: 0,
	fetch(request) {
		const body = files.get(new URL(request.url).pathname);

		return body === undefined ? new Response('Not found', { status: 404 }) : new Response(body);
	},
});

let web: TestContext;
let api: ReturnType<typeof serveEndpoints>;

// Bound and stopped up front, so nothing is listening on its port.
const closed = Bun.serve({ port: 0, fetch: () => new Response() });
const unreachableUrl = closed.url.origin;

closed.stop(true);

function sha256(bundle: string): string {
	return new Bun.CryptoHasher('sha256').update(bundle).digest('hex');
}

// Publishes `version` of `id` on the CDN and approves it with the digest of `published`, which is
// the served bundle unless a test wants the two to differ.
async function release(
	ownerId: string,
	id: string,
	version: string,
	served: string,
	published: string = served,
) {
	const next = manifest(id, version);

	files.set(`/addons/${id}/${version}/manifest.json`, JSON.stringify(next));
	files.set(`/addons/${id}/${version}/index.js`, served);

	await seedVersion(web.ctx, ownerId, next, sha256(published));
}

const INSTALLED = '1.0.0';
const INSTALLED_SHA256 = sha256(INSTALLED);

function seed(manager: FakeAddons, id: string, started: boolean, version: string = INSTALLED) {
	manager.seed({
		id,
		data: makeManifest(id, version),
		bundle: version,
		instance: started ? makeInstance('old', manager.log) : null,
		started,
		failed: false,
	});
}

function recordEvents(manager: FakeAddons): string[] {
	const events: string[] = [];
	const record = (name: string) => (entity: Addon) => void events.push(`${name}:${entity.id}`);

	manager.on('reloaded', record('reloaded'));
	manager.on('updated', record('updated'));
	manager.on('update-error', record('update-error'));

	return events;
}

type CheckResult = {
	requests: unknown[];
	pending: PendingUpdate[];
	applied: boolean[];
};

// Checks the managers' addons with one request, applies every update through its owning manager,
// and returns the bodies of the updates requests it sent.
async function check(
	managers: FakeAddons[],
	baseUrl: string = api.url.origin,
): Promise<CheckResult> {
	const requests = spyOn(globalThis, 'fetch');
	const owners = new Map<string, FakeAddons>();
	const entries: InstalledEntry[] = [];

	for (const manager of managers) {
		for (const entry of listInstalled(PLUGINS, manager)) {
			if (!owners.has(entry.id)) {
				owners.set(entry.id, manager);
			}

			entries.push(entry);
		}
	}

	try {
		const pending = await fetchUpdates(entries, { baseUrl, clientVersion: CLIENT_VERSION });
		const applied = await Promise.all(
			pending.map(async (update) => {
				const owner = owners.get(update.id);

				return owner ? applyUpdate(owner, update) : false;
			}),
		);

		return { requests: await sentBodies(requests.mock.calls), pending, applied };
	} finally {
		requests.mockRestore();
	}
}

async function sentBodies(calls: Parameters<typeof fetch>[]) {
	const sent = calls
		.map(([input, init]) => new Request(input, init))
		.filter((request) => new URL(request.url).pathname === '/api/v1/updates');

	return Promise.all(
		sent.map(async (request) => updatesRequestSchema.parse(await request.json())),
	);
}

describe.skipIf(!MAINTENANCE_URL)('fetchUpdates and applyUpdate', () => {
	afterAll(async () => {
		api.stop(true);
		cdn.stop(true);
		await web.close();
	});

	beforeAll(async () => {
		web = await createTestContext({ CDN_URL: cdn.url.origin });
		api = serveEndpoints(web.ctx, { 'POST /api/v1/updates': checkUpdatesEndpoint });

		const { userId } = await signInWithDiscord(web.ctx, {
			id: '80351110224678920',
			name: 'Owner',
			email: 'owner@example.com',
		});

		for (const id of ['up.applied', 'up.disabled', 'up.tampered', 'up.current']) {
			await seedApprovedAddon(web.ctx, userId, manifest(id, '1.0.0'));
		}

		await release(userId, 'up.applied', '1.1.0', 'applied-1.1.0');
		await release(userId, 'up.disabled', '1.1.0', 'disabled-1.1.0');
		await release(userId, 'up.tampered', '1.1.0', 'tampered-served', 'tampered-reviewed');
	});

	beforeEach(resetDevice);

	test('sends one request when nothing is newer and leaves addons untouched', async () => {
		const manager = new FakeAddons();
		const events = recordEvents(manager);

		seed(manager, 'up.current', true);

		const { requests, pending } = await check([manager]);

		expect(pending).toEqual([]);
		expect(requests).toEqual([
			{
				clientVersion: CLIENT_VERSION,
				addons: [{ id: 'up.current', version: '1.0.0', sha256: INSTALLED_SHA256 }],
			},
		]);
		expect(manager.getEntity('up.current')?.bundle).toBe(INSTALLED);
		expect(manager.log).toEqual([]);
		expect(writes).toEqual([]);
		expect(events).toEqual([]);
	});

	test('applies updates across managers from one request, keeping enabled state', async () => {
		const plugins = new FakeAddons();
		const others = new FakeAddons();
		const pluginEvents = recordEvents(plugins);
		const otherEvents = recordEvents(others);

		seed(plugins, 'up.applied', true);
		seed(plugins, 'local.addon', true);
		seed(others, 'up.disabled', false);
		seed(others, 'local.unversioned', false, 'dev');

		const { requests, pending, applied } = await check([plugins, others]);

		expect(requests).toEqual([
			{
				clientVersion: CLIENT_VERSION,
				addons: [
					{ id: 'up.applied', version: '1.0.0', sha256: INSTALLED_SHA256 },
					{ id: 'local.addon', version: '1.0.0', sha256: INSTALLED_SHA256 },
					{ id: 'up.disabled', version: '1.0.0', sha256: INSTALLED_SHA256 },
				],
			},
		]);

		expect(
			pending.map((entry) => [
				entry.id,
				entry.from,
				entry.update.version,
				entry.update.changelogs.length,
			]),
		).toEqual([
			['up.applied', '1.0.0', '1.1.0', 1],
			['up.disabled', '1.0.0', '1.1.0', 1],
		]);
		expect(applied).toEqual([true, true]);

		const updated = plugins.getEntity('up.applied');

		expect(updated?.data.version).toBe('1.1.0');
		expect(updated?.bundle).toBe('applied-1.1.0');
		expect(updated?.started).toBe(true);
		expect(plugins.log).toEqual(['stop:old', 'start:applied-1.1.0']);

		const disabled = others.getEntity('up.disabled');

		expect(disabled?.data.version).toBe('1.1.0');
		expect(disabled?.bundle).toBe('disabled-1.1.0');
		expect(disabled?.started).toBe(false);
		expect(others.log).toEqual([]);

		expect(plugins.getEntity('local.addon')?.bundle).toBe(INSTALLED);
		expect(others.getEntity('local.unversioned')?.bundle).toBe('dev');
		expect(writes.toSorted()).toEqual([
			'Unbound/Plugins/up.applied/index.js',
			'Unbound/Plugins/up.applied/manifest.json',
			'Unbound/Plugins/up.disabled/index.js',
			'Unbound/Plugins/up.disabled/manifest.json',
		]);
		expect(pluginEvents).toEqual(['reloaded:up.applied', 'updated:up.applied']);
		expect(otherEvents).toEqual(['reloaded:up.disabled', 'updated:up.disabled']);
	});

	test('rejects a bundle whose SHA-256 does not match and keeps the old version running', async () => {
		const manager = new FakeAddons();
		const events = recordEvents(manager);

		seed(manager, 'up.tampered', true);

		expect((await check([manager])).applied).toEqual([false]);

		const tampered = manager.getEntity('up.tampered');

		expect(tampered?.data.version).toBe('1.0.0');
		expect(tampered?.bundle).toBe(INSTALLED);
		expect(tampered?.started).toBe(true);
		expect(manager.log).toEqual([]);
		expect(writes).toEqual([]);
		expect(events).toEqual(['update-error:up.tampered']);
		expect(manager.errors.get('up.tampered')?.message).toBe(
			`Bundle SHA-256 ${sha256('tampered-served')} does not match ${sha256('tampered-reviewed')}.`,
		);
	});

	test('rejects and changes nothing when the server is unreachable', async () => {
		const manager = new FakeAddons();
		const events = recordEvents(manager);

		seed(manager, 'up.applied', true);

		expect(await check([manager], unreachableUrl).catch((error) => error)).toBeInstanceOf(
			Error,
		);

		expect(manager.getEntity('up.applied')?.bundle).toBe(INSTALLED);
		expect(manager.log).toEqual([]);
		expect(writes).toEqual([]);
		expect(events).toEqual([]);
	});
});

describe('listInstalled', () => {
	beforeEach(resetDevice);

	test('leaves out a development copy until it is installed from the store again', () => {
		const manager = new FakeAddons();

		seed(manager, 'up.store', true);
		seed(manager, 'up.pushed', true);
		manager.markDevelopmentCopy('up.pushed');

		expect(listInstalled(PLUGINS, manager).map((entry) => entry.id)).toEqual(['up.store']);
		expect(manager.isDevelopmentCopy('up.pushed')).toBe(true);
		expect(manager.isDevelopmentCopy('up.store')).toBe(false);
	});
});

describe('development markers', () => {
	beforeEach(resetDevice);

	test('a plugin installed with ubd install loads as a development copy', async () => {
		const manager = new FakeAddons();

		existingFiles.add('Unbound/Plugins/up.installed/development');
		manager.load('', makeManifest('up.installed', '1.0.0'));
		manager.load('', makeManifest('up.store', '1.0.0'));
		await Bun.sleep(0);

		expect(manager.isDevelopmentCopy('up.installed')).toBe(true);
		expect(manager.isDevelopmentCopy('up.store')).toBe(false);
	});
});

describe('reinstallFromStore', () => {
	beforeEach(resetDevice);

	test('clears the development mark even when the store has nothing newer', async () => {
		const manager = new FakeAddons();

		seed(manager, 'up.pushed', true);
		manager.markDevelopmentCopy('up.pushed');

		const applied = await reinstallFromStore(PLUGINS, manager, 'up.pushed', {
			baseUrl: 'http://127.0.0.1:9',
			clientVersion: CLIENT_VERSION,
		}).catch(() => false);

		expect(applied).toBe(false);
		expect(manager.isDevelopmentCopy('up.pushed')).toBe(false);
	});
});
