import { DiscordAPIError, PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import { and, eq, inArray, isNotNull, type SQL } from 'drizzle-orm';
import { createLogger } from '@unbound-app/logger';

import {
	ADDON_DEVELOPER_ROLE_ID,
	CONTRIBUTOR_ROLE_ID,
	GUILD_ID,
	SPONSOR_ROLE_ID,
} from '~/lib/constants';
import { type ContributorCache, createContributorCache } from '~/lib/github-contributors';
import createSerialQueue from '~/runtime/serial-queue';
import { member, roleGrant } from '~/db/schema';
import type { Database } from '~/db/database';

const logger = createLogger('Bot', 'Roles');

// Verbatim subsets of the discord.js surface this file touches; `Dispatcher[]` in index.ts proves a real client fits.
export type FetchMember = { user: string; force: true };
export type RolesRole = { id: string; name: string; position: number };
export type HighestRole = RolesRole & { comparePositionTo: (roleId: string) => number };
export type BotMember = {
	permissions: { has: (permission: bigint) => boolean };
	roles: { highest: HighestRole };
};
/** No `remove`: the type makes grant-only impossible to break. */
export type RolesMember = {
	roles: {
		cache: { has: (roleId: string) => boolean };
		add: (roleId: string, reason?: string) => Promise<RolesMember>;
	};
};
export type RolesGuild = {
	roles: { cache: { get: (roleId: string) => RolesRole | undefined } };
	members: { me: BotMember | null; fetch: (options: FetchMember) => Promise<RolesMember> };
};
export type JoinedMember = { id: string; guild: { id: string } };
export type RolesClient = {
	guilds: { fetch: (guildId: string) => Promise<RolesGuild> };
	on: (event: 'guildMemberAdd', listener: (member: JoinedMember) => void) => void;
};
export type RolesContext = { db: Database; client: RolesClient };

export type RoleKey = 'contributor' | 'addonDeveloper' | 'sponsor';
export type RoleIds = Record<RoleKey, string>;
export type MemberRow = typeof member.$inferSelect;

/** One Discord account: the union of every member row with this discord id. */
type Claim = { discordId: string; wanted: ReadonlySet<RoleKey>; granted: ReadonlySet<string> };
/** Role id per key; a role blocked by the guild is absent and was logged. */
type Grantable = ReadonlyMap<RoleKey, string>;
type Pending = [key: RoleKey, roleId: string];

export type RolesOptions = {
	guildId?: string;
	roleIds?: RoleIds;
	contributors?: ContributorCache;
};

export type RolesDispatcher = {
	name: 'roles';
	channel: 'member_changed';
	reconcile: (context: RolesContext) => Promise<void>;
	handle: (payload: string, context: RolesContext) => Promise<void>;
	/** Resolves once every queued sync, including joins, has settled. */
	drain: () => Promise<void>;
};

const ROLE_KEYS: RoleKey[] = ['contributor', 'addonDeveloper', 'sponsor'];
const ROLE_CONSTANTS: Record<RoleKey, string> = {
	contributor: 'CONTRIBUTOR_ROLE_ID',
	addonDeveloper: 'ADDON_DEVELOPER_ROLE_ID',
	sponsor: 'SPONSOR_ROLE_ID',
};
const DEFAULT_ROLE_IDS: RoleIds = {
	contributor: CONTRIBUTOR_ROLE_ID,
	addonDeveloper: ADDON_DEVELOPER_ROLE_ID,
	sponsor: SPONSOR_ROLE_ID,
};

/**
 * @description Decides the roles one member row qualifies for.
 * @param row The member row.
 * @param contributors Contributor GitHub ids, or undefined when no list has loaded yet.
 * @returns The qualifying role keys; empty unless GitHub and Discord are both linked.
 */
export function qualifyingRoles(
	row: MemberRow,
	contributors: ReadonlySet<string> | undefined,
): Set<RoleKey> {
	const roles = new Set<RoleKey>();

	if (!row.discordId || row.githubId === null) {
		return roles;
	}

	if (contributors?.has(row.githubId)) {
		roles.add('contributor');
	}

	if (row.isAddonDeveloper) {
		roles.add('addonDeveloper');
	}

	if (row.isSponsor) {
		roles.add('sponsor');
	}

	return roles;
}

function pendingRoles(claim: Claim, roles: Grantable): Pending[] {
	const pending: Pending[] = [];

	for (const key of claim.wanted) {
		const roleId = roles.get(key);

		if (roleId && !claim.granted.has(roleId)) {
			pending.push([key, roleId]);
		}
	}

	return pending;
}

function isUnknownMember(error: unknown): error is DiscordAPIError {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMember;
}

/**
 * @description Creates the grant-only role-sync dispatcher.
 * @param options Guild, role ids and contributor cache; production defaults.
 * @returns A dispatcher assignable to `Dispatcher`, plus `drain()`.
 */
export function createRolesDispatcher(options: RolesOptions = {}): RolesDispatcher {
	const {
		guildId = GUILD_ID,
		roleIds = DEFAULT_ROLE_IDS,
		contributors = createContributorCache(),
	} = options;
	const allRoles: Grantable = new Map(ROLE_KEYS.map((key) => [key, roleIds[key]]));
	const queue = createSerialQueue();
	let attached = false;

	async function loadClaims(db: Database, where: SQL | undefined): Promise<Claim[]> {
		const ids = await contributors.get();
		const rows = await db
			.select()
			.from(member)
			.where(and(isNotNull(member.githubId), where));
		const wanted = new Map<string, Set<RoleKey>>();

		for (const row of rows) {
			const roles = qualifyingRoles(row, ids);

			if (!roles.size) {
				continue;
			}

			wanted.set(row.discordId, new Set([...(wanted.get(row.discordId) ?? []), ...roles]));
		}

		if (!wanted.size) {
			return [];
		}

		const grants = await db
			.select()
			.from(roleGrant)
			.where(inArray(roleGrant.discordId, [...wanted.keys()]));
		const granted = new Map<string, Set<string>>();

		for (const grant of grants) {
			granted.set(
				grant.discordId,
				(granted.get(grant.discordId) ?? new Set()).add(grant.role),
			);
		}

		// A claim with nothing left to grant costs no Discord call.
		return [...wanted]
			.map(([discordId, roles]) => ({
				discordId,
				wanted: roles,
				granted: granted.get(discordId) ?? new Set<string>(),
			}))
			.filter((claim) => pendingRoles(claim, allRoles).length);
	}

	function grantableRoles(guild: RolesGuild): Grantable {
		const grantable = new Map<RoleKey, string>();
		const me = guild.members.me;

		if (!me) {
			logger.error(
				`Cannot grant any role: the bot's member in guild ${guildId} is not cached.`,
			);

			return grantable;
		}

		const highest = me.roles.highest;

		if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
			logger.error(
				`Cannot grant any role: the bot's role "${highest.name}" lacks Manage Roles. Enable it in Server Settings > Roles.`,
			);

			return grantable;
		}

		for (const [key, roleId] of allRoles) {
			const role = guild.roles.cache.get(roleId);

			if (!role) {
				logger.error(
					`Cannot grant ${key}: role ${ROLE_CONSTANTS[key]}=${roleId} does not exist in guild ${guildId}. Fix it in src/lib/constants.ts.`,
				);

				continue;
			}

			if (highest.comparePositionTo(roleId) <= 0) {
				logger.error(
					`Cannot grant "${role.name}" (position ${role.position}): the bot's highest role "${highest.name}" (position ${highest.position}) is not above it. In Server Settings > Roles, drag "${highest.name}" above "${role.name}".`,
				);

				continue;
			}

			grantable.set(key, roleId);
		}

		return grantable;
	}

	async function grantClaim(db: Database, guild: RolesGuild, claim: Claim, grantable: Grantable) {
		const pending = pendingRoles(claim, grantable);

		if (!pending.length) return;

		let target: RolesMember;

		try {
			target = await guild.members.fetch({ user: claim.discordId, force: true });
		} catch (error) {
			if (isUnknownMember(error)) {
				logger.debug(
					`Discord user ${claim.discordId} is not in the guild; waiting for a join.`,
				);

				return;
			}

			throw error;
		}

		for (const [key, roleId] of pending) {
			// Held by hand: leave it alone and record nothing.
			if (target.roles.cache.has(roleId)) {
				continue;
			}

			await target.roles.add(roleId, `Unbound role sync: ${key}`);
			await db
				.insert(roleGrant)
				.values({ discordId: claim.discordId, role: roleId })
				.onConflictDoNothing();
			logger.info(`Granted ${key} to Discord user ${claim.discordId}.`);
		}
	}

	async function sync(current: RolesContext, where: SQL | undefined) {
		const claims = await loadClaims(current.db, where);

		if (!claims.length) return;

		const guild = await current.client.guilds.fetch(guildId);
		const grantable = grantableRoles(guild);

		for (const claim of claims) {
			try {
				await grantClaim(current.db, guild, claim, grantable);
			} catch (error) {
				logger.error(`Failed to grant roles to Discord user ${claim.discordId}:`, error);
			}
		}
	}

	// Without the GuildMembers intent joins never fire; the runtime's periodic reconcile catches them.
	function attach(context: RolesContext) {
		if (attached) return;

		attached = true;
		context.client.on('guildMemberAdd', (joined) => {
			if (joined.guild.id !== guildId) return;

			queue
				.enqueue(() => sync(context, eq(member.discordId, joined.id)))
				.catch((error) => {
					logger.error(
						`Failed to sync roles for joined Discord user ${joined.id}:`,
						error,
					);
				});
		});
	}

	return {
		name: 'roles',
		channel: 'member_changed',
		reconcile(current) {
			attach(current);

			return queue.enqueue(() => sync(current, undefined));
		},
		handle(userId, current) {
			const discordIds = current.db
				.select({ discordId: member.discordId })
				.from(member)
				.where(eq(member.userId, userId));

			return queue.enqueue(() => sync(current, inArray(member.discordId, discordIds)));
		},
		drain: () => queue.drain(),
	};
}

export const rolesDispatcher = createRolesDispatcher();

export default { createRolesDispatcher, qualifyingRoles, rolesDispatcher };
