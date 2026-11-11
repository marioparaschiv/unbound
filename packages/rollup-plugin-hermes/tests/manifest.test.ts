import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	buildManifest,
	fetchManifest,
	hermescBinary,
	parseRegistryVersions,
	resolveHermesTargets,
} from '~/manifest';
import type { ManifestContext } from '~/manifest';

type RegistryVersion = { version: string };

/** The abbreviated npm document, trimmed to what the manifest reads. */
type RegistryDocument = { name: string; versions: Record<string, RegistryVersion> };

const REGISTRY: RegistryDocument = {
	name: '@unbound-app/hermesc',
	versions: {
		'94.0.0': { version: '94.0.0' },
		'96.0.0': { version: '96.0.0' },
		'98.0.0': { version: '98.0.0' },
	},
};

const MANIFEST = {
	latest: [98, 96, 94],
	versions: { '98': { npm: '98.0.0' }, '96': { npm: '96.0.0' }, '94': { npm: '94.0.0' } },
};

const ctx: ManifestContext = {
	warn: () => {},
	error: (message) => {
		throw new Error(message);
	},
};

let cacheDir: string;

beforeEach(() => {
	cacheDir = mkdtempSync(join(tmpdir(), 'rph-test-'));
});

afterEach(() => {
	rmSync(cacheDir, { recursive: true, force: true });
});

function registryFetch(body: RegistryDocument, { status = 200, etag = '' } = {}): typeof fetch {
	const stub = async () =>
		new Response(JSON.stringify(body), { status, headers: etag ? { etag } : {} });

	return Object.assign(stub, { preconnect: fetch.preconnect });
}

function installBinary(root: string) {
	mkdirSync(join(root, process.platform), { recursive: true });
	writeFileSync(hermescBinary(root), 'binary');
}

describe('buildManifest', () => {
	test('keeps the newest release of each bytecode version by numeric order', () => {
		expect(buildManifest(['98.0.9', '98.0.10', '96.0.0'])).toEqual({
			latest: [98, 96],
			versions: { '98': { npm: '98.0.10' }, '96': { npm: '96.0.0' } },
		});
	});

	test('lists every bytecode version, newest first', () => {
		expect(buildManifest(['90.0.0', '94.0.0', '98.0.0', '96.0.0']).latest).toEqual([
			98, 96, 94, 90,
		]);
	});

	test('ignores versions without a numeric major', () => {
		expect(buildManifest(['next', '98.0.0']).latest).toEqual([98]);
	});
});

describe('parseRegistryVersions', () => {
	test('reads the version keys', () => {
		expect(parseRegistryVersions(REGISTRY)).toEqual(['94.0.0', '96.0.0', '98.0.0']);
	});

	test('rejects a document without versions', () => {
		expect(parseRegistryVersions({ error: 'Not found' })).toBeUndefined();
	});
});

describe('fetchManifest', () => {
	test('a 200 caches the manifest and its etag', async () => {
		const manifest = await fetchManifest(
			ctx,
			{ cacheDir },
			{ fetch: registryFetch(REGISTRY, { etag: '"abc123"' }) },
		);

		expect(manifest).toEqual(MANIFEST);
		expect(readFileSync(join(cacheDir, 'etag'), 'utf-8')).toBe('"abc123"');
		expect(JSON.parse(readFileSync(join(cacheDir, 'manifest.json'), 'utf-8'))).toEqual(
			MANIFEST,
		);
	});

	test('a 304 reuses the cached manifest after sending If-None-Match', async () => {
		writeFileSync(join(cacheDir, 'etag'), '"abc123"');
		writeFileSync(join(cacheDir, 'manifest.json'), JSON.stringify(MANIFEST));

		let sent: string | undefined;

		async function stub(_url: string | URL | Request, init?: RequestInit) {
			sent = new Headers(init?.headers).get('If-None-Match') ?? undefined;

			return new Response(null, { status: 304 });
		}

		const manifest = await fetchManifest(
			ctx,
			{ cacheDir },
			{ fetch: Object.assign(stub, { preconnect: fetch.preconnect }) },
		);

		expect(sent).toBe('"abc123"');
		expect(manifest).toEqual(MANIFEST);
	});

	test('a network error falls back to the cached manifest', async () => {
		writeFileSync(join(cacheDir, 'manifest.json'), JSON.stringify(MANIFEST));

		const stub = async () => Promise.reject(new Error('ECONNREFUSED'));
		const manifest = await fetchManifest(
			ctx,
			{ cacheDir },
			{ fetch: Object.assign(stub, { preconnect: fetch.preconnect }) },
		);

		expect(manifest).toEqual(MANIFEST);
	});

	test('a network error without a cache fails', async () => {
		const stub = async () => Promise.reject(new Error('ECONNREFUSED'));

		const error = await fetchManifest(
			ctx,
			{ cacheDir },
			{ fetch: Object.assign(stub, { preconnect: fetch.preconnect }) },
		).then(
			() => undefined,
			(error: Error) => error,
		);

		expect(error?.message).toMatch(/none are cached/);
	});
});

describe('resolveHermesTargets', () => {
	test('downloads each held version once', async () => {
		const downloaded: string[] = [];

		async function download(npmVersion: string, root: string) {
			downloaded.push(npmVersion);
			installBinary(root);
		}

		const targets = await resolveHermesTargets(
			ctx,
			{ cacheDir },
			{ fetch: registryFetch(REGISTRY), download },
		);

		expect(downloaded).toEqual(['98.0.0', '96.0.0', '94.0.0']);
		expect(targets.map((target) => target.version)).toEqual([98, 96, 94]);
		expect(targets.every((target) => target.dir)).toBe(true);
	});

	test('holds exactly the requested versions, newest first', async () => {
		const targets = await resolveHermesTargets(
			ctx,
			{ cacheDir, versions: [94, 98] },
			{
				fetch: registryFetch(REGISTRY),
				download: async (_npmVersion, root) => installBinary(root),
			},
		);

		expect(targets.map((target) => target.version)).toEqual([98, 94]);
	});

	test('fails on a requested version hermesc does not publish', async () => {
		const resolved = resolveHermesTargets(
			ctx,
			{ cacheDir, versions: [98, 97] },
			{
				fetch: registryFetch(REGISTRY),
				download: async (_npmVersion, root) => installBinary(root),
			},
		);

		expect(resolved).rejects.toThrow('hermesc does not publish bytecode 97.');
	});

	test('skips the download when the binary is already cached', async () => {
		for (const npm of ['98.0.0', '96.0.0', '94.0.0'])
			installBinary(join(cacheDir, 'hermesc', npm));

		let downloads = 0;

		const targets = await resolveHermesTargets(
			ctx,
			{ cacheDir },
			{
				fetch: registryFetch(REGISTRY),
				download: async () => {
					downloads++;
				},
			},
		);

		expect(downloads).toBe(0);
		expect(targets.every((target) => target.dir && existsSync(hermescBinary(target.dir)))).toBe(
			true,
		);
	});

	test('reports a failed download as a target without a directory', async () => {
		const targets = await resolveHermesTargets(
			ctx,
			{ cacheDir, versions: [98] },
			{
				fetch: registryFetch(REGISTRY),
				download: async () => Promise.reject(new Error('E404')),
			},
		);

		expect(targets).toEqual([{ version: 98, dir: null }]);
	});
});
