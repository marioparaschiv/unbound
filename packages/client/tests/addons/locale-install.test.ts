import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { FakeAddons, makeManifest, resetDevice, writes } from '../helpers/addons';

const ID = 'locales.example';
const files: Record<string, string> = {
	[`/${ID}/i18n/de.json`]: '{"TITLE":"Willkommen"}',
	[`/${ID}/i18n/fr.json`]: '{"TITLE":"Bienvenue"}',
	[`/${ID}/i18n/es.json`]: '{"TITLE":"altered"}',
};
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const requested: string[] = [];

const server = Bun.serve({
	port: 0,
	fetch(request) {
		const { pathname } = new URL(request.url);

		requested.push(pathname);

		if (pathname.endsWith('/manifest.json')) {
			return Response.json({
				...makeManifest(ID),
				locales: {
					de: digest(files[`/${ID}/i18n/de.json`]),
					fr: digest(files[`/${ID}/i18n/fr.json`]),
					// Served, but not the bytes the manifest lists.
					es: digest('{"TITLE":"Hola"}'),
					// Listed, but never served.
					ja: digest('{}'),
				},
			});
		}

		const file = files[pathname];

		return file === undefined
			? new Response('({})', { status: pathname.endsWith('.json') ? 404 : 200 })
			: new Response(file);
	},
});

beforeEach(() => {
	resetDevice();
	requested.length = 0;
});

afterEach(() => {
	globalThis.NativePlatform = undefined;
});

afterAll(() => {
	server.stop(true);
});

describe('installing a plugin with locales', () => {
	test('downloads every listed locale beside the bundle and installs despite the ones that fail', async () => {
		const manager = new FakeAddons();
		const installed = await manager.install(`${server.url.origin}/${ID}/manifest.json`);

		expect(installed?.id).toBe(ID);
		expect(requested).toEqual(
			expect.arrayContaining([
				`/${ID}/i18n/de.json`,
				`/${ID}/i18n/fr.json`,
				`/${ID}/i18n/es.json`,
				`/${ID}/i18n/ja.json`,
			]),
		);
		expect(writes.filter((path) => path.includes('/i18n/')).toSorted()).toEqual([
			`Unbound/Plugins/${ID}/i18n/de.json`,
			`Unbound/Plugins/${ID}/i18n/fr.json`,
		]);
	});
});
