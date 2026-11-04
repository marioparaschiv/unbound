import {
	EntryType,
	FALLBACK_ROLE_COLOR,
	PERMISSION_TITLES,
	type EntryTypeValue,
	type SortOrder,
} from '~/constants';

export type PermissionBit = {
	name: string;
	bit: bigint;
};

export type Role = {
	id: string;
	name?: string;
	permissions?: unknown;
	position?: number;
	colorString?: string | null;
};

export type Member = {
	userId: string;
	nick?: string | null;
	roles?: readonly string[] | null;
};

export type Overwrite = {
	id: string;
	type: number;
	allow?: unknown;
	deny?: unknown;
};

export type Entry = {
	type: EntryTypeValue;
	id?: string;
	permissions?: bigint;
	allow?: bigint;
	deny?: bigint;
};

export type PermissionState = 'allowed' | 'denied' | 'default';

export type GrantedPermission = {
	permission: string;
	roleName: string;
	roleColor: string;
	rolePosition: number;
};

export type TitleResolver = (permission: PermissionBit) => string;

/**
 * @description Reads a permission value Discord stores as a bigint, a number or a decimal string.
 * @param value The stored value.
 * @returns The value as a bigint, or `0n` when it is none of those.
 */
export function toBits(value: unknown): bigint {
	if (typeof value === 'bigint') return value;

	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
		return BigInt(value);
	}

	if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);

	return 0n;
}

function isSingleBit(bit: bigint): boolean {
	return bit > 0n && (bit & (bit - 1n)) === 0n;
}

/**
 * @description Lists Discord's permission flags once each, in the order Discord defines them, keeping the name the plugin has a title for when two names share a flag.
 * @param permissions Discord's `Permissions` constants, keyed by name.
 * @returns Each single-bit permission with its name.
 */
export function listPermissionBits(
	permissions: Record<string, unknown> | undefined,
): PermissionBit[] {
	const byBit = new Map<bigint, PermissionBit>();

	for (const [name, value] of Object.entries(permissions ?? {})) {
		const bit = toBits(value);

		if (!isSingleBit(bit)) continue;

		const known = byBit.get(bit);

		if (!known) {
			byBit.set(bit, { name, bit });
		} else if (!(known.name in PERMISSION_TITLES) && name in PERMISSION_TITLES) {
			known.name = name;
		}
	}

	return [...byBit.values()];
}

/**
 * @description Combines every permission flag, which is what a server owner has.
 * @param bits The permissions to combine.
 * @returns The combined flags.
 */
export function allPermissions(bits: readonly PermissionBit[]): bigint {
	return bits.reduce((total, { bit }) => total | bit, 0n);
}

/**
 * @description Turns a constant name such as `MANAGE_GUILD` into a readable title.
 * @param name The permission's constant name.
 * @returns Discord's title for it, or the name in title case when the plugin does not know it.
 */
export function fallbackTitle(name: string): string {
	const known = PERMISSION_TITLES[name];

	if (known) return known;

	return name
		.toLowerCase()
		.split('_')
		.filter(Boolean)
		.map((word) => word[0]!.toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * @description Picks a member's roles from a server's roles, counting `@everyone`, whose ID is the server's.
 * @param roles The server's roles, in the order to keep.
 * @param guildId The server's ID.
 * @param member The member.
 * @returns The roles the member has.
 */
export function memberRoles<R extends Role>(
	roles: readonly R[],
	guildId: string,
	member: Member,
): R[] {
	const owned = new Set(member.roles ?? []);

	return roles.filter((role) => role.id === guildId || owned.has(role.id));
}

/**
 * @description Orders roles from the highest or lowest position, the order that decides which role is shown as granting a permission.
 * @param roles The roles to order.
 * @param order Which end to start from.
 * @returns A new, sorted array.
 */
export function sortRoles<R extends Role>(roles: readonly R[], order: SortOrder): R[] {
	const direction = order === 'lowest' ? 1 : -1;

	return [...roles].sort((a, b) => direction * ((a.position ?? 0) - (b.position ?? 0)));
}

/**
 * @description Orders roles from the highest position down, the order Discord lists them in.
 * @param roles The roles to order.
 * @returns A new, sorted array.
 */
export function sortByPosition<R extends Role>(roles: readonly R[]): R[] {
	return sortRoles(roles, 'highest');
}

/**
 * @description Lists each permission a member's roles grant, with the role that grants it, as Vencord's user popout shows them.
 * @param options The member's roles, the permission flags, the role order, whether the member owns the server and how to title a permission.
 * @returns The granted permissions, ordered from the highest granting role down, with server ownership first.
 */
export function grantedPermissions(options: {
	roles: readonly Role[];
	bits: readonly PermissionBit[];
	order: SortOrder;
	isOwner: boolean;
	ownerTitle: string;
	title: TitleResolver;
}): GrantedPermission[] {
	const granted: GrantedPermission[] = [];

	if (options.isOwner) {
		granted.push({
			permission: options.ownerTitle,
			roleName: 'Owner',
			roleColor: FALLBACK_ROLE_COLOR,
			rolePosition: Infinity,
		});
	}

	const roles = sortRoles(options.roles, options.order);

	for (const permission of options.bits) {
		const role = roles.find((candidate) => {
			return (toBits(candidate.permissions) & permission.bit) === permission.bit;
		});

		if (!role) continue;

		granted.push({
			permission: options.title(permission),
			roleName: role.name ?? 'Unknown Role',
			roleColor: role.colorString || FALLBACK_ROLE_COLOR,
			rolePosition: role.position ?? 0,
		});
	}

	return granted.sort((a, b) => b.rolePosition - a.rolePosition);
}

/**
 * @description Decides what an entry says about one permission.
 * @param entry A role or owner, which grants or lacks it, or an overwrite, which allows, denies or leaves it.
 * @param bit The permission flag.
 * @returns `allowed`, `denied`, or `default` when an overwrite leaves the permission alone.
 */
export function permissionState(entry: Entry, bit: bigint): PermissionState {
	if (entry.permissions !== undefined) {
		return (entry.permissions & bit) === bit ? 'allowed' : 'denied';
	}

	if (entry.allow !== undefined && (entry.allow & bit) === bit) return 'allowed';

	if (entry.deny !== undefined && (entry.deny & bit) === bit) return 'denied';

	return 'default';
}

/**
 * @description Orders entries as Vencord's permission list does: roles, then members, then the owner.
 * @param entries The entries.
 * @returns A new array, stable within each type.
 */
export function sortEntries(entries: readonly Entry[]): Entry[] {
	return [...entries].sort((a, b) => a.type - b.type);
}

/**
 * @description Builds the entries for a server's roles.
 * @param roles The roles, highest first.
 * @returns One entry per role.
 */
export function roleEntries(roles: readonly Role[]): Entry[] {
	return roles.map((role) => ({
		type: EntryType.Role,
		id: role.id,
		permissions: toBits(role.permissions),
	}));
}

/**
 * @description Builds the entries for a member: their roles, and an owner entry with every permission when they own the server.
 * @param roles The member's roles, highest first.
 * @param isOwner Whether the member owns the server.
 * @param bits Every permission flag.
 * @returns The entries.
 */
export function memberEntries(
	roles: readonly Role[],
	isOwner: boolean,
	bits: readonly PermissionBit[],
): Entry[] {
	const entries = roleEntries(roles);

	if (isOwner) entries.push({ type: EntryType.Owner, permissions: allPermissions(bits) });

	return sortEntries(entries);
}

/**
 * @description Builds the entries for a channel's permission overwrites, role overwrites from the highest role down, then member overwrites.
 * @param overwrites The channel's overwrites, keyed by role or user ID as Discord stores them.
 * @param rolePosition Reads a role's position, or `undefined` for a role that is gone.
 * @returns The entries.
 */
export function channelEntries(
	overwrites: Record<string, Overwrite> | readonly Overwrite[] | null | undefined,
	rolePosition: (roleId: string) => number | undefined,
): Entry[] {
	const list = Array.isArray(overwrites) ? overwrites : Object.values(overwrites ?? {});
	const entries = list
		.filter(
			(overwrite) => overwrite.type === EntryType.Role || overwrite.type === EntryType.Member,
		)
		.map((overwrite) => ({
			type: overwrite.type as EntryTypeValue,
			id: overwrite.id,
			allow: toBits(overwrite.allow),
			deny: toBits(overwrite.deny),
		}));

	return entries.sort((a, b) => {
		if (a.type !== b.type) return a.type - b.type;

		if (a.type !== EntryType.Role) return 0;

		return (rolePosition(b.id) ?? -1) - (rolePosition(a.id) ?? -1);
	});
}

/**
 * @description Lists the members an entry list names that the client has not loaded, so they can be requested.
 * @param entries The entries.
 * @param isLoaded Whether a member is loaded.
 * @returns Their user IDs.
 */
export function missingMemberIds(
	entries: readonly Entry[],
	isLoaded: (userId: string) => boolean,
): string[] {
	return entries
		.filter((entry) => entry.type === EntryType.Member && entry.id && !isLoaded(entry.id))
		.map((entry) => entry.id!);
}

/**
 * @description Lists the permissions an entry has something to say about, in flag order.
 * @param entry The entry.
 * @param bits Every permission flag.
 * @returns Each permission with its state, leaving out ones an overwrite leaves alone.
 */
export function entryPermissions(
	entry: Entry,
	bits: readonly PermissionBit[],
): { permission: PermissionBit; state: Exclude<PermissionState, 'default'> }[] {
	const listed = [];

	for (const permission of bits) {
		const state = permissionState(entry, permission.bit);

		if (state !== 'default') listed.push({ permission, state });
	}

	return listed;
}
