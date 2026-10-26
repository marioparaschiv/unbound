import {
	addonResponseSchema,
	listAddonsResponseSchema,
	maintainersResponseSchema,
	myAddonsResponseSchema,
} from '@unbound-app/contracts/addons';
import { updatesResponseSchema } from '@unbound-app/contracts/updates';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import removeMaintainerEndpoint from '~/endpoints/remove-maintainer';
import listMaintainersEndpoint from '~/endpoints/list-maintainers';
import addMaintainerEndpoint from '~/endpoints/add-maintainer';
import transferAddonEndpoint from '~/endpoints/transfer-addon';
import checkUpdatesEndpoint from '~/endpoints/check-updates';
import delistAddonEndpoint from '~/endpoints/delist-addon';
import relistAddonEndpoint from '~/endpoints/relist-addon';
import listAddonsEndpoint from '~/endpoints/list-addons';
import myAddonsEndpoint from '~/endpoints/my-addons';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';
import type { Api } from '~/api';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { authRequest, createTestContext, signInWithDiscord } from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';

const NOW = new Date('2026-10-17T12:00:00.000Z');

const base = await createTestContext();
const ctx: AppContext = { ...base.ctx, now: () => NOW };

const server = serveEndpoints(ctx, {
	'GET /api/v1/addons': listAddonsEndpoint,
	'GET /api/v1/addons/$id/maintainers': listMaintainersEndpoint,
	'POST /api/v1/addons/$id/maintainers': addMaintainerEndpoint,
	'DELETE /api/v1/addons/$id/maintainers/$userId': removeMaintainerEndpoint,
	'POST /api/v1/addons/$id/transfer': transferAddonEndpoint,
	'POST /api/v1/addons/$id/delist': delistAddonEndpoint,
	'POST /api/v1/addons/$id/relist': relistAddonEndpoint,
	'GET /api/v1/me/addons': myAddonsEndpoint,
	'POST /api/v1/updates': checkUpdatesEndpoint,
});

afterAll(async () => {
	await server.stop(true);
	await base.close();
});

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: `8035111022467${String(users).padStart(4, '0')}`,
		name: `User ${users}`,
		email: `user-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	return { userId, headers, client: createApiClient<Api>({ baseUrl: server.url.href, headers }) };
}

type Member = Awaited<ReturnType<typeof signUp>>;

const anonymous = createApiClient<Api>({ baseUrl: server.url.href });

function maintainers(client: Member['client'], id: string) {
	return client('GET /api/v1/addons/$id/maintainers', {
		params: { id },
		response: maintainersResponseSchema,
	});
}

function addMaintainer(client: Member['client'], id: string, userId: string) {
	return client('POST /api/v1/addons/$id/maintainers', {
		params: { id },
		body: { userId },
		response: maintainersResponseSchema,
	});
}

function removeMaintainer(client: Member['client'], id: string, userId: string) {
	return client('DELETE /api/v1/addons/$id/maintainers/$userId', {
		params: { id, userId },
		response: maintainersResponseSchema,
	});
}

function transfer(client: Member['client'], id: string, userId: string, keep?: boolean) {
	return client('POST /api/v1/addons/$id/transfer', {
		params: { id },
		body: { userId, keepPreviousOwner: keep },
		response: maintainersResponseSchema,
	});
}

function delist(client: Member['client'], id: string) {
	return client('POST /api/v1/addons/$id/delist', {
		params: { id },
		response: addonResponseSchema,
	});
}

function relist(client: Member['client'], id: string) {
	return client('POST /api/v1/addons/$id/relist', {
		params: { id },
		response: addonResponseSchema,
	});
}

async function ownedAddon(id: string) {
	const owner = await signUp();

	await seedApprovedAddon(ctx, owner.userId, manifest(id));

	return owner;
}

function roles(list: Pick<Member, 'userId'>[], members: { id: string; role: string }[]) {
	return list.map(({ userId }) => members.find((member) => member.id === userId)?.role);
}

describe('maintainers', () => {
	test('an owner adds and removes maintainers', async () => {
		const owner = await ownedAddon('own.manage');
		const helper = await signUp();

		const added = await addMaintainer(owner.client, 'own.manage', helper.userId);

		expect(roles([owner, helper], added.maintainers)).toEqual(['owner', 'maintainer']);

		const removed = await removeMaintainer(owner.client, 'own.manage', helper.userId);

		expect(roles([owner, helper], removed.maintainers)).toEqual(['owner', undefined]);
	});

	test('maintainers who joined at the same instant are listed by user id', async () => {
		const owner = await ownedAddon('own.ties');
		const helpers = [await signUp(), await signUp(), await signUp()].map(
			(helper) => helper.userId,
		);

		// Added in descending id order, all at the context's fixed clock.
		for (const userId of helpers.toSorted().toReversed()) {
			await addMaintainer(owner.client, 'own.ties', userId);
		}

		const listed = (await maintainers(anonymous, 'own.ties')).maintainers;

		expect(listed.map((member) => member.id)).toEqual([owner.userId, ...helpers.toSorted()]);
	});

	test('a maintainer cannot manage maintainers and a non-member gets 403', async () => {
		const owner = await ownedAddon('own.denied');
		const helper = await signUp('developer');
		const stranger = await signUp();

		await addMaintainer(owner.client, 'own.denied', helper.userId);

		expect(await failure(addMaintainer(helper.client, 'own.denied', stranger.userId))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(await failure(removeMaintainer(helper.client, 'own.denied', owner.userId))).toEqual({
			status: 403,
			code: 'forbidden',
		});
		expect(
			await failure(addMaintainer(stranger.client, 'own.denied', stranger.userId)),
		).toEqual({ status: 403, code: 'not_maintainer' });
		expect(await failure(addMaintainer(anonymous, 'own.denied', stranger.userId))).toEqual({
			status: 401,
			code: 'unauthorized',
		});
	});

	test('the only owner cannot remove themselves', async () => {
		const owner = await ownedAddon('own.last');

		expect(await failure(removeMaintainer(owner.client, 'own.last', owner.userId))).toEqual({
			status: 409,
			code: 'last_owner',
		});
		expect(roles([owner], (await maintainers(anonymous, 'own.last')).maintainers)).toEqual([
			'owner',
		]);
	});

	test('adding an unknown user or managing an unknown addon is not_found', async () => {
		const owner = await ownedAddon('own.unknown');

		expect(await failure(addMaintainer(owner.client, 'own.unknown', 'nobody'))).toEqual({
			status: 404,
			code: 'not_found',
		});
		expect(await failure(addMaintainer(owner.client, 'own.missing', owner.userId))).toEqual({
			status: 404,
			code: 'not_found',
		});
	});
});

describe('ownership transfer', () => {
	test.each<Role>(['user', 'developer', 'moderator'])(
		'a %s cannot transfer ownership',
		async (role) => {
			const owner = await ownedAddon(`transfer.denied-${role}`);
			const caller = await signUp(role);

			expect(
				await failure(transfer(caller.client, `transfer.denied-${role}`, caller.userId)),
			).toEqual({ status: 403, code: 'forbidden' });
			expect(
				roles(
					[owner],
					(await maintainers(anonymous, `transfer.denied-${role}`)).maintainers,
				),
			).toEqual(['owner']);
		},
	);

	test('an admin transfers ownership and keeps the previous owner as maintainer', async () => {
		const owner = await ownedAddon('transfer.keep');
		const admin = await signUp('admin');
		const heir = await signUp();

		const result = await transfer(admin.client, 'transfer.keep', heir.userId);

		expect(roles([owner, heir], result.maintainers)).toEqual(['maintainer', 'owner']);
	});

	test('an admin can drop the previous owner and promote an existing maintainer', async () => {
		const owner = await ownedAddon('transfer.drop');
		const admin = await signUp('admin');
		const helper = await signUp();

		await addMaintainer(owner.client, 'transfer.drop', helper.userId);

		const result = await transfer(admin.client, 'transfer.drop', helper.userId, false);

		expect(result.maintainers.map((member) => [member.id, member.role])).toEqual([
			[helper.userId, 'owner'],
		]);
	});
});

describe('delisting', () => {
	test.each<[Role, boolean]>([
		['user', false],
		['developer', false],
		['moderator', true],
		['admin', true],
	])('a %s may delist and relist: %p', async (role, allowed) => {
		const id = `delist.role-${role}`;

		await ownedAddon(id);

		const caller = await signUp(role);

		if (!allowed) {
			expect(await failure(delist(caller.client, id))).toEqual({
				status: 403,
				code: 'forbidden',
			});
			expect(await failure(relist(caller.client, id))).toEqual({
				status: 403,
				code: 'forbidden',
			});

			return;
		}

		expect((await delist(caller.client, id)).addon.delistedAt).toBe(NOW.toISOString());
		expect((await relist(caller.client, id)).addon.delistedAt).toBeNull();
	});

	test('a delisted addon leaves listings and update checks until relisted', async () => {
		const owner = await ownedAddon('delist.hidden');
		const moderator = await signUp('moderator');

		await seedVersion(ctx, owner.userId, manifest('delist.hidden', '1.1.0'));

		async function visible() {
			const listed = await anonymous('GET /api/v1/addons', {
				response: listAddonsResponseSchema,
			});
			const updates = await anonymous('POST /api/v1/updates', {
				body: {
					clientVersion: '1.0.0',
					addons: [{ id: 'delist.hidden', version: '1.0.0' }],
				},
				response: updatesResponseSchema,
			});

			return {
				listed: listed.addons.some((entry) => entry.id === 'delist.hidden'),
				updated: updates.updates.some((entry) => entry.id === 'delist.hidden'),
			};
		}

		expect(await visible()).toEqual({ listed: true, updated: true });

		await delist(moderator.client, 'delist.hidden');

		expect(await visible()).toEqual({ listed: false, updated: false });

		await relist(moderator.client, 'delist.hidden');

		expect(await visible()).toEqual({ listed: true, updated: true });
	});
});

describe('my addons', () => {
	test('lists maintained addons with their newest version, open updates and open listings', async () => {
		const owner = await ownedAddon('mine.owned');
		const helper = await signUp('developer');

		await addMaintainer(owner.client, 'mine.owned', helper.userId);

		await seedSubmission(ctx, helper.userId, manifest('mine.owned', '1.1.0'), {
			kind: 'update',
		});
		await seedSubmission(ctx, helper.userId, manifest('mine.listing'), {
			status: 'changes_requested',
		});
		await seedSubmission(ctx, helper.userId, manifest('mine.rejected'), {
			status: 'rejected',
		});

		const result = await helper.client('GET /api/v1/me/addons', {
			response: myAddonsResponseSchema,
		});

		expect(result.addons).toHaveLength(1);
		expect(result.addons[0]).toMatchObject({
			id: 'mine.owned',
			role: 'maintainer',
			delistedAt: null,
			latestVersion: { version: '1.0.0' },
			openSubmissions: [
				{ addonId: 'mine.owned', version: '1.1.0', status: 'pending_review' },
			],
		});
		expect(result.openListings.map((entry) => entry.addonId)).toEqual(['mine.listing']);
	});
});

describe('roles', () => {
	test.each<[Role, number]>([
		['user', 403],
		['developer', 403],
		['moderator', 403],
		['admin', 200],
	])('a %s setting a role through the admin plugin gets %d', async (role, status) => {
		const caller = await signUp(role);
		const target = await signUp();

		const response = await authRequest(ctx, '/admin/set-role', {
			method: 'POST',
			headers: caller.headers,
			body: JSON.stringify({ userId: target.userId, role: 'moderator' }),
		});

		const stored = await ctx.db.query.user.findFirst({ where: { id: target.userId } });

		expect(response.status).toBe(status);
		expect(stored?.role).toBe(status === 200 ? 'moderator' : 'user');
	});
});
