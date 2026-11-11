import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AddonManifest } from '@unbound-app/types';
import { createHash } from 'node:crypto';

import { FakeAddons, makeManifest, resetDevice, writes } from '../helpers/addons';

const ID = 'assets.example';
const STAR = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const STAR_2X = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 4, 5, 6]);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const MISSING = 'f'.repeat(64);
const ALTERED = 'e'.repeat(64);

const manifest: AddonManifest = {
	...makeManifest(ID),
	assets: {
		'icons/star': {
			type: 'png',
			width: 24,
			height: 24,
			scales: { 1: sha(STAR), 2: sha(STAR_2X) },
		},
		gone: { type: 'png', width: 8, height: 8, scales: { 1: MISSING } },
		altered: { type: 'png', width: 8, height: 8, scales: { 1: ALTERED } },
	},
};

const files = new Map([
	[`/${ID}/assets/${sha(STAR)}.png`, STAR],
	[`/${ID}/assets/${sha(STAR_2X)}.png`, STAR_2X],
	[`/${ID}/assets/${ALTERED}.png`, STAR],
]);
const requested: string[] = [];

const server = Bun.serve({
	port: 0,
	fetch(request) {
		const { pathname } = new URL(request.url);
		const file = files.get(pathname);

		requested.push(pathname);

		if (pathname.endsWith('/manifest.json')) {
			return Response.json(manifest);
		}

		if (pathname.endsWith('/index.js')) {
			return new Response('({})');
		}

		return file ? new Response(file) : new Response('missing', { status: 404 });
	},
});

beforeEach(() => {
	resetDevice();
	requested.length = 0;
});

afterAll(() => {
	server.stop(true);
});

describe('installing a plugin with images', () => {
	test('downloads every listed file beside the bundle, and a failed one does not fail the install', async () => {
		const manager = new FakeAddons();
		const logged: string[] = [];
		const logger = Reflect.get(manager, 'logger');

		logger.error = (message: string) => void logged.push(message);

		const installed = await manager.install(`${server.url.origin}/${ID}/manifest.json`);

		expect(installed?.id).toBe(ID);
		expect(requested).toEqual(
			expect.arrayContaining([...files.keys(), `/${ID}/assets/${MISSING}.png`]),
		);
		expect(writes).toEqual(
			expect.arrayContaining([
				`Unbound/Plugins/${ID}/assets/${sha(STAR)}.png`,
				`Unbound/Plugins/${ID}/assets/${sha(STAR_2X)}.png`,
			]),
		);
		expect(
			writes.some(
				(path) => path.endsWith(`${MISSING}.png`) || path.endsWith(`${ALTERED}.png`),
			),
		).toBe(false);
		expect(logged.toSorted()).toEqual([
			`Failed to download asset altered for ${ID}:`,
			`Failed to download asset gone for ${ID}:`,
		]);
	});
});
