import { describe, expect, test } from 'bun:test';

import {
	allPermissions,
	channelEntries,
	entryPermissions,
	fallbackTitle,
	grantedPermissions,
	listPermissionBits,
	memberEntries,
	memberRoles,
	missingMemberIds,
	permissionState,
	roleEntries,
	sortEntries,
	sortRoles,
	toBits,
	type Role,
} from '~/lib/model';
import { EntryType, FALLBACK_ROLE_COLOR } from '~/lib/constants';

const PERMISSIONS = {
	CREATE_INSTANT_INVITE: 1n << 0n,
	KICK_MEMBERS: 1n << 1n,
	BAN_MEMBERS: 1n << 2n,
	ADMINISTRATOR: 1n << 3n,
	MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
	MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
};

const bits = listPermissionBits(PERMISSIONS);
const title = ({ name }: { name: string }) => fallbackTitle(name);

const everyone: Role = { id: 'g', name: '@everyone', position: 0, permissions: 1n };
const mod: Role = {
	id: 'm',
	name: 'Mod',
	position: 5,
	permissions: 0b110n,
	colorString: '#ff0000',
};
const helper: Role = {
	id: 'h',
	name: 'Helper',
	position: 2,
	permissions: 0b010n,
	colorString: null,
};

describe('toBits', () => {
	test('reads bigints, safe integers and decimal strings', () => {
		expect(toBits(8n)).toBe(8n);
		expect(toBits(8)).toBe(8n);
		expect(toBits('1099511627776')).toBe(1099511627776n);
	});

	test('treats anything else as no permissions', () => {
		expect(toBits(undefined)).toBe(0n);
		expect(toBits('abc')).toBe(0n);
		expect(toBits(-1)).toBe(0n);
		expect(toBits(1.5)).toBe(0n);
	});
});

describe('listPermissionBits', () => {
	test('keeps Discord order, one entry per flag, preferring the titled alias', () => {
		expect(bits.map(({ name }) => name)).toEqual([
			'CREATE_INSTANT_INVITE',
			'KICK_MEMBERS',
			'BAN_MEMBERS',
			'ADMINISTRATOR',
			'MANAGE_GUILD_EXPRESSIONS',
		]);
	});

	test('skips values that are not a single flag', () => {
		expect(listPermissionBits({ A: 3n, B: 0n, C: 'x', D: 4n })).toEqual([
			{ name: 'D', bit: 4n },
		]);
		expect(listPermissionBits(undefined)).toEqual([]);
	});

	test('combines every flag for the owner', () => {
		expect(allPermissions(bits)).toBe(0b1111n | (1n << 30n));
	});
});

describe('fallbackTitle', () => {
	test("uses Discord's title when known and title-cases the rest", () => {
		expect(fallbackTitle('MANAGE_GUILD')).toBe('Manage Server');
		expect(fallbackTitle('MODERATE_MEMBERS')).toBe('Timeout Members');
		expect(fallbackTitle('SOME_NEW_THING')).toBe('Some New Thing');
	});
});

describe('memberRoles', () => {
	test('keeps the member roles and @everyone in the given order', () => {
		const roles = [mod, helper, everyone];

		expect(memberRoles(roles, 'g', { userId: 'u', roles: ['h'] })).toEqual([helper, everyone]);
		expect(memberRoles(roles, 'g', { userId: 'u', roles: null })).toEqual([everyone]);
	});
});

describe('sortRoles', () => {
	test('orders by position from either end without changing the input', () => {
		const roles = [helper, everyone, mod];

		expect(sortRoles(roles, 'highest').map(({ id }) => id)).toEqual(['m', 'h', 'g']);
		expect(sortRoles(roles, 'lowest').map(({ id }) => id)).toEqual(['g', 'h', 'm']);
		expect(roles.map(({ id }) => id)).toEqual(['h', 'g', 'm']);
	});
});

describe('grantedPermissions', () => {
	const roles = [mod, helper, everyone];

	test('credits the highest role with each permission by default', () => {
		const granted = grantedPermissions({
			roles,
			bits,
			order: 'highest',
			isOwner: false,
			ownerTitle: 'Server Owner',
			title,
		});

		expect(granted).toEqual([
			{
				permission: 'Kick, Approve, and Reject Members',
				roleName: 'Mod',
				roleColor: '#ff0000',
				rolePosition: 5,
			},
			{ permission: 'Ban Members', roleName: 'Mod', roleColor: '#ff0000', rolePosition: 5 },
			{
				permission: 'Create Invite',
				roleName: '@everyone',
				roleColor: FALLBACK_ROLE_COLOR,
				rolePosition: 0,
			},
		]);
	});

	test('credits the lowest role when sorting from the bottom', () => {
		const granted = grantedPermissions({
			roles,
			bits,
			order: 'lowest',
			isOwner: false,
			ownerTitle: 'Server Owner',
			title,
		});

		expect(granted.map(({ permission, roleName }) => [permission, roleName])).toEqual([
			['Ban Members', 'Mod'],
			['Kick, Approve, and Reject Members', 'Helper'],
			['Create Invite', '@everyone'],
		]);
	});

	test('puts server ownership first', () => {
		const granted = grantedPermissions({
			roles: [everyone],
			bits,
			order: 'highest',
			isOwner: true,
			ownerTitle: 'Server Owner',
			title,
		});

		expect(granted[0]).toEqual({
			permission: 'Server Owner',
			roleName: 'Owner',
			roleColor: FALLBACK_ROLE_COLOR,
			rolePosition: Infinity,
		});
		expect(granted).toHaveLength(2);
	});
});

describe('permissionState', () => {
	test('roles either have or lack a permission', () => {
		expect(permissionState({ type: EntryType.Role, permissions: 0b10n }, 0b10n)).toBe(
			'allowed',
		);
		expect(permissionState({ type: EntryType.Role, permissions: 0b10n }, 0b01n)).toBe('denied');
	});

	test('overwrites allow, deny or leave a permission alone', () => {
		const overwrite = { type: EntryType.Member, allow: 0b01n, deny: 0b10n };

		expect(permissionState(overwrite, 0b01n)).toBe('allowed');
		expect(permissionState(overwrite, 0b10n)).toBe('denied');
		expect(permissionState(overwrite, 0b100n)).toBe('default');
	});
});

describe('entries', () => {
	test('a member lists their roles, then an owner entry with every permission', () => {
		const entries = memberEntries([mod, everyone], true, bits);

		expect(entries.map(({ type, id }) => [type, id])).toEqual([
			[EntryType.Role, 'm'],
			[EntryType.Role, 'g'],
			[EntryType.Owner, undefined],
		]);
		expect(entries[2]!.permissions).toBe(allPermissions(bits));
	});

	test('server roles keep their order and read stored permissions', () => {
		expect(roleEntries([{ id: 'r', permissions: '4' }])).toEqual([
			{ type: EntryType.Role, id: 'r', permissions: 4n },
		]);
	});

	test('channel overwrites list roles from the highest down, then members', () => {
		const positions: Record<string, number> = { m: 5, h: 2, g: 0 };
		const entries = channelEntries(
			{
				u1: { id: 'u1', type: 1, allow: '1', deny: '0' },
				g: { id: 'g', type: 0, allow: 0n, deny: 1n },
				m: { id: 'm', type: 0, allow: 2n, deny: 0n },
				gone: { id: 'gone', type: 0, allow: 0n, deny: 0n },
				h: { id: 'h', type: 0, allow: 4n, deny: 0n },
			},
			(id) => positions[id],
		);

		expect(entries.map(({ id }) => id)).toEqual(['m', 'h', 'g', 'gone', 'u1']);
		expect(entries.at(-1)).toEqual({ type: EntryType.Member, id: 'u1', allow: 1n, deny: 0n });
	});

	test('channel overwrites accept an array and nothing at all', () => {
		expect(channelEntries([{ id: 'u', type: 1 }], () => undefined)).toHaveLength(1);
		expect(channelEntries(undefined, () => undefined)).toEqual([]);
	});

	test('sorting by type is stable', () => {
		const sorted = sortEntries([
			{ type: EntryType.Owner },
			{ type: EntryType.Member, id: 'a' },
			{ type: EntryType.Role, id: 'b' },
			{ type: EntryType.Member, id: 'c' },
		]);

		expect(sorted.map(({ type, id }) => `${type}${id ?? ''}`)).toEqual(['0b', '1a', '1c', '2']);
	});

	test('lists the members the client still has to load', () => {
		const entries = [
			{ type: EntryType.Member, id: 'a' },
			{ type: EntryType.Member, id: 'b' },
			{ type: EntryType.Role, id: 'c' },
		];

		expect(missingMemberIds(entries, (id) => id === 'a')).toEqual(['b']);
	});

	test('an entry lists only the permissions it says something about', () => {
		const listed = entryPermissions({ type: EntryType.Member, allow: 1n, deny: 4n }, bits);

		expect(listed.map(({ permission, state }) => [permission.name, state])).toEqual([
			['CREATE_INSTANT_INVITE', 'allowed'],
			['BAN_MEMBERS', 'denied'],
		]);
	});
});
