import type { Member, MemberQuery, MemberSubject } from '@unbound-app/web/bot';
import { DiscordAPIError, PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import { createLogger } from '@unbound-app/logger';
import { inArray } from 'drizzle-orm';

import {
	ADDON_DEVELOPER_ROLE_ID,
	CONTRIBUTOR_ROLE_ID,
	GUILD_ID,
	SPONSOR_ROLE_ID,
} from '~/lib/constants';
import { type ContributorCache, createContributorCache } from '~/lib/github-contributors';
import createSerialQueue from '~/runtime/serial-queue';
import type { IdConstantName } from '~/lib/constants';
import type { Stores } from '~/dispatchers/types';
import type { Database } from '~/db/database';
import { roleGrant } from '~/db/schema';

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
export type RolesContext = Stores & { client: RolesClient };

export type RoleKey = 'contributor' | 'addonDeveloper' | 'sponsor';
export type RoleIds = Record<RoleKey, string>;
/** One Discord account: the union of every member with this discord id. */
type Claim = { discordId: string; wanted: ReadonlySet<RoleKey>; granted: ReadonlySet<string> };
/** Role id per key; a role blocked by the guild is absent and was logged. */
type Grantable = ReadonlyMap<RoleKey, string>;
type Pending = [key: RoleKey, roleId: string];
type RoleCheck = { grantable: Map<RoleKey, string>; problems: string[] };

export type RolesOptions = {
	guildId?: string;
	roleIds?: RoleIds;
	contributors?: ContributorCache;
	now?: () => number;
};

export type RolesDispatcher = {
	name: 'roles';
	channel: 'member_changed';
	requires: readonly IdConstantName[];
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
const DELETED_RETRY_MS = 60 * 60 * 1000;
const ALL_MEMBERS: MemberQuery = { by: 'all' };
// The subjects the bot's triggers write into `member_changed` payloads; `discord` is for joins only.
const PAYLOAD_SUBJECTS: ReadonlySet<string> = new Set<MemberSubject>(['user', 'github', 'addon']);

function isPayloadSubject(value: string): value is MemberSubject {
	return PAYLOAD_SUBJECTS.has(value);
}

/**
 * @description Reads a `member_changed` payload written by the bot's triggers.
 * @param payload `user:<id>`, `github:<id>` or `addon:<id>`.
 * @returns The members it names, or undefined for a payload no trigger writes.
 */
export function parseMemberPayload(payload: string): MemberQuery | undefined {
	const separator = payload.indexOf(':');
	const by = payload.slice(0, separator);
	const id = payload.slice(separator + 1);

	if (separator < 0 || !id || !isPayloadSubject(by)) return;

	return { by, ids: [id] };
}

/**
 * @description Decides the roles one member qualifies for.
 * @param row The member.
 * @param contributors Contributor GitHub ids, or undefined when no list has loaded yet.
 * @returns The qualifying role keys; empty unless GitHub is linked too.
 */
export function qualifyingRoles(
	row: Member,
	contributors: ReadonlySet<string> | undefined,
): Set<RoleKey> {
	const roles = new Set<RoleKey>();

	if (row.githubId === null) {
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

function heldKey(discordId: string, roleId: string) {
	return `${discordId}:${roleId}`;
}

function pendingRoles(claim: Claim, roles: Grantable, held: ReadonlySet<string>): Pending[] {
	const pending: Pending[] = [];

	for (const key of claim.wanted) {
		const roleId = roles.get(key);

		if (roleId && !claim.granted.has(roleId) && !held.has(heldKey(claim.discordId, roleId))) {
			pending.push([key, roleId]);
		}
	}

	return pending;
}

function isNotInGuild(error: unknown): error is DiscordAPIError {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMember;
}

function isDeletedUser(error: unknown): error is DiscordAPIError {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownUser;
}

function isMissingPermissions(error: unknown): error is DiscordAPIError {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions;
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
		now = Date.now,
	} = options;
	const allRoles: Grantable = new Map(ROLE_KEYS.map((key) => [key, roleIds[key]]));
	const queue = createSerialQueue();
	// `discordId:roleId` pairs seen held by hand; per process, so a restart checks them once more.
	const held = new Set<string>();
	// Discord id -> epoch ms before which a deleted account is not fetched again; one not in the guild is retried every run.
	const deleted = new Map<string, number>();
	let reported = new Set<string>();
	let attached = false;

	async function loadClaims({ db, web }: Stores, query: MemberQuery): Promise<Claim[]> {
		const ids = await contributors.get();
		const rows = await web.members(query);
		const wanted = new Map<string, Set<RoleKey>>();

		for (const row of rows) {
			const { discordId } = row;
			const roles = qualifyingRoles(row, ids);

			if (!roles.size || (deleted.get(discordId) ?? 0) > now()) {
				continue;
			}

			wanted.set(discordId, new Set([...(wanted.get(discordId) ?? []), ...roles]));
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

		// Granted, held by hand or cooling down after a miss: a converged account costs no Discord call.
		return [...wanted]
			.map(([discordId, roles]) => ({
				discordId,
				wanted: roles,
				granted: granted.get(discordId) ?? new Set<string>(),
			}))
			.filter((claim) => pendingRoles(claim, allRoles, held).length);
	}

	function checkRoles(guild: RolesGuild): RoleCheck {
		const grantable = new Map<RoleKey, string>();
		const problems: string[] = [];
		const me = guild.members.me;

		if (!me) {
			problems.push(
				`Cannot grant any role: the bot's member in guild ${guildId} is not cached.`,
			);

			return { grantable, problems };
		}

		const highest = me.roles.highest;

		if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
			problems.push(
				`Cannot grant any role: the bot's role "${highest.name}" lacks Manage Roles. Enable it in Server Settings > Roles.`,
			);

			return { grantable, problems };
		}

		for (const [key, roleId] of allRoles) {
			const role = guild.roles.cache.get(roleId);

			if (!role) {
				problems.push(
					`Cannot grant ${key}: role ${ROLE_CONSTANTS[key]}=${roleId} does not exist in guild ${guildId}. Fix it in src/lib/constants.ts.`,
				);

				continue;
			}

			if (highest.comparePositionTo(roleId) <= 0) {
				problems.push(
					`Cannot grant "${role.name}" (position ${role.position}): the bot's highest role "${highest.name}" (position ${highest.position}) is not above it. In Server Settings > Roles, drag "${highest.name}" above "${role.name}".`,
				);

				continue;
			}

			grantable.set(key, roleId);
		}

		return { grantable, problems };
	}

	// Every timed reconcile meets the same guild, so a problem is logged when it appears, not on each run.
	function report(problems: string[]) {
		if (
			problems.length === reported.size &&
			problems.every((problem) => reported.has(problem))
		) {
			return;
		}

		if (!problems.length) {
			logger.info('Role grants are unblocked: every guild-level problem is resolved.');
		}

		for (const problem of problems) {
			logger.error(problem);
		}

		reported = new Set(problems);
	}

	async function grantRole(
		db: Database,
		target: RolesMember,
		discordId: string,
		pending: Pending,
	) {
		const [key, roleId] = pending;

		await target.roles.add(roleId, `Unbound role sync: ${key}`);
		await db.insert(roleGrant).values({ discordId, role: roleId }).onConflictDoNothing();
		logger.info(`Granted ${key} to Discord user ${discordId}.`);
	}

	// `grantable` is this run's; a role Discord refuses with 50013 leaves it for the rest of the run.
	async function grantClaim(
		db: Database,
		guild: RolesGuild,
		claim: Claim,
		grantable: Map<RoleKey, string>,
	) {
		const pending = pendingRoles(claim, grantable, held);

		if (!pending.length) return;

		let target: RolesMember;

		try {
			target = await guild.members.fetch({ user: claim.discordId, force: true });
			deleted.delete(claim.discordId);
		} catch (error) {
			if (isNotInGuild(error)) {
				logger.debug(
					`Discord user ${claim.discordId} is not in the guild; retrying on the next reconcile.`,
				);

				return;
			}

			if (isDeletedUser(error)) {
				deleted.set(claim.discordId, now() + DELETED_RETRY_MS);
				logger.debug(
					`Discord user ${claim.discordId} is a deleted account; retrying in an hour.`,
				);

				return;
			}

			throw error;
		}

		for (const role of pending) {
			const [key, roleId] = role;

			// Held by hand: remember it, record nothing.
			if (target.roles.cache.has(roleId)) {
				held.add(heldKey(claim.discordId, roleId));

				continue;
			}

			try {
				await grantRole(db, target, claim.discordId, role);
			} catch (error) {
				if (!isMissingPermissions(error)) {
					logger.error(
						`Failed to grant ${key} to Discord user ${claim.discordId}:`,
						error,
					);

					continue;
				}

				grantable.delete(key);
				logger.error(
					`Cannot grant ${key}: Discord answered Missing Permissions (50013) for role ${roleId}. Check the role is not managed by an integration and sits below the bot's highest role; skipping it this run.`,
				);
			}
		}
	}

	async function sync(current: RolesContext, query: MemberQuery) {
		const claims = await loadClaims(current, query);

		if (!claims.length) return;

		const guild = await current.client.guilds.fetch(guildId);
		const { grantable, problems } = checkRoles(guild);

		report(problems);

		for (const claim of claims) {
			try {
				await grantClaim(current.db, guild, claim, grantable);
			} catch (error) {
				logger.error(`Failed to grant roles to Discord user ${claim.discordId}:`, error);
			}
		}
	}

	// The bot runs without the privileged GuildMembers intent, so this never fires today and the timed reconcile grants joins; it costs nothing if the intent is approved.
	function attach(context: RolesContext) {
		if (attached) return;

		attached = true;
		context.client.on('guildMemberAdd', (joined) => {
			if (joined.guild.id !== guildId) return;

			queue
				.enqueue(() => sync(context, { by: 'discord', ids: [joined.id] }))
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
		requires: ['CONTRIBUTOR_ROLE_ID', 'ADDON_DEVELOPER_ROLE_ID', 'SPONSOR_ROLE_ID'],
		reconcile(current) {
			attach(current);

			return queue.enqueue(() => sync(current, ALL_MEMBERS));
		},
		handle(payload, current) {
			const query = parseMemberPayload(payload);

			if (!query) return Promise.resolve();

			return queue.enqueue(() => sync(current, query));
		},
		drain: () => queue.drain(),
	};
}

export const rolesDispatcher = createRolesDispatcher();

export default { parseMemberPayload, createRolesDispatcher, qualifyingRoles, rolesDispatcher };
