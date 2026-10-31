import {
	addonIconResponseSchema,
	listAddonsResponseSchema,
	maintainersResponseSchema,
} from '@unbound-app/contracts/addons';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import {
	ADDON_ICON_NAMES,
	ATLAS_COLUMNS,
	ATLAS_PITCH,
	buildAddonIconAtlas,
	renderAddonIcon,
} from '~/lib/addon-icons';
import addMaintainerEndpoint from '~/endpoints/add-maintainer';
import setAddonIconEndpoint from '~/endpoints/set-addon-icon';
import listAddonsEndpoint from '~/endpoints/list-addons';
import { createApiClient } from '~/api/client';
import { user } from '~/db/schema';
import type { Api } from '~/api';

import { createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { failure, serveEndpoints } from './helpers/server';

const base = await createTestContext();
const { ctx } = base;

const server = serveEndpoints(ctx, {
	'GET /api/v1/addons': listAddonsEndpoint,
	'POST /api/v1/addons/$id/maintainers': addMaintainerEndpoint,
	'PUT /api/v1/addons/$id/icon': setAddonIconEndpoint,
});

afterAll(async () => {
	await server.stop(true);
	await base.close();
});

let users = 0;

async function signUp() {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022468${String(users).padStart(4, '0')}`,
		name: `Icon User ${users}`,
		email: `icon-user-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role: 'developer' }).where(eq(user.id, userId));

	return { userId, client: createApiClient<Api>({ baseUrl: server.url.href, headers }) };
}

type Member = Awaited<ReturnType<typeof signUp>>;

const anonymous = createApiClient<Api>({ baseUrl: server.url.href });

function setIcon(client: Member['client'], id: string, icon: string | null) {
	return client('PUT /api/v1/addons/$id/icon', {
		params: { id },
		body: { icon },
		response: addonIconResponseSchema,
	});
}

async function listedIcon(id: string) {
	const { addons } = await anonymous('GET /api/v1/addons', {
		response: listAddonsResponseSchema,
	});

	return addons.find((entry) => entry.id === id)?.icon;
}

async function ownedAddon(id: string) {
	const owner = await signUp();

	await seedApprovedAddon(ctx, owner.userId, manifest(id));

	return owner;
}

describe('addon icons', () => {
	test('a maintainer picks an icon the listing shows, then resets it', async () => {
		const owner = await ownedAddon('icon.pick');
		const helper = await signUp();

		await owner.client('POST /api/v1/addons/$id/maintainers', {
			params: { id: 'icon.pick' },
			body: { userId: helper.userId },
			response: maintainersResponseSchema,
		});

		expect(await listedIcon('icon.pick')).toBeNull();
		expect(await setIcon(helper.client, 'icon.pick', 'IconRocket')).toEqual({
			icon: 'IconRocket',
		});
		expect(await listedIcon('icon.pick')).toBe('IconRocket');
		expect(await setIcon(owner.client, 'icon.pick', null)).toEqual({ icon: null });
		expect(await listedIcon('icon.pick')).toBeNull();
	});

	test('only maintainers pick, and only icons that exist', async () => {
		const owner = await ownedAddon('icon.denied');
		const stranger = await signUp();

		expect(await failure(setIcon(stranger.client, 'icon.denied', 'IconRocket'))).toEqual({
			status: 403,
			code: 'not_maintainer',
		});
		expect(await failure(setIcon(anonymous, 'icon.denied', 'IconRocket'))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
		expect(await failure(setIcon(owner.client, 'icon.denied', 'IconNoSuchThing'))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(await failure(setIcon(owner.client, 'icon.missing', 'IconRocket'))).toEqual({
			status: 404,
			code: 'not_found',
		});
		expect(await listedIcon('icon.denied')).toBeNull();
	});

	test('an icon renders as markup sized by its container, and the atlas holds every icon', () => {
		expect(renderAddonIcon('IconRocket')).toStartWith('<svg');
		expect(renderAddonIcon('IconRocket')).toContain('width="100%"');
		expect(renderAddonIcon('IconNoSuchThing')).toBeNull();
		expect(renderAddonIcon(null)).toBeNull();

		const atlas = buildAddonIconAtlas();
		const cells = [...atlas.matchAll(/<svg x="(\d+)" y="(\d+)"/g)];
		const rocket = ADDON_ICON_NAMES.indexOf('IconRocket');

		expect(rocket).toBeGreaterThan(-1);
		expect(ADDON_ICON_NAMES).not.toContain('Icon');
		expect(cells).toHaveLength(ADDON_ICON_NAMES.length);
		expect(cells[rocket]?.slice(1)).toEqual([
			String((rocket % ATLAS_COLUMNS) * ATLAS_PITCH + 1),
			String(Math.floor(rocket / ATLAS_COLUMNS) * ATLAS_PITCH + 1),
		]);
	});
});
