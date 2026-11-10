import type { Member, MemberQuery, MemberSubject } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import { PermissionFlagsBits } from 'discord.js';
import { inArray } from 'drizzle-orm';

import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { ContributorCache } from '~/lib/github-contributors';
import { IDS_SOURCE, type IdConstantName } from '~/lib/config';
import { discordFailure } from '~/lib/discord-messages';
import type { Database } from '~/db/database';
import { roleGrant } from '~/db/schema';

const logger = createLogger('Bot', 'Roles');

// Verbatim subsets of the discord.js surface this file touches; index.ts proves a real client's guilds fit.
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
export type RolesGuilds = { fetch: (guildId: string) => Promise<RolesGuild> };

type RoleDefinition = {
	key: string;
	/** The id constant holding the role's id. */
	constant: IdConstantName;
	/** Asked only of a member with GitHub linked, the precondition of every role. */
	qualifies: (row: Member, contributors: ReadonlySet<string> | undefined) => boolean;
};

// Adding a role is one entry here and its id constant.
const ROLES = [
	{
		key: 'contributor',
		constant: 'CONTRIBUTOR_ROLE_ID',
		qualifies: (row, contributors) =>
			row.githubId !== null && Boolean(contributors?.has(row.githubId)),
	},
	{
		key: 'addonDeveloper',
		constant: 'ADDON_DEVELOPER_ROLE_ID',
		qualifies: (row) => row.isAddonDeveloper,
	},
	{ key: 'sponsor', constant: 'SPONSOR_ROLE_ID', qualifies: (row) => row.isSponsor },
] as const satisfies readonly RoleDefinition[];

export type RoleKey = (typeof ROLES)[number]['key'];
export type RoleConstant = (typeof ROLES)[number]['constant'];

/** The id constants the roles dispatcher needs; it is not started while one is unset. */
export const ROLE_CONSTANTS: readonly RoleConstant[] = ROLES.map((role) => role.constant);
/** One Discord account: the union of every member with this discord id. */
type Claim = { discordId: string; wanted: ReadonlySet<RoleKey>; granted: ReadonlySet<string> };
/** Role id per key; a role blocked by the guild is absent and was logged. */
type Grantable = ReadonlyMap<RoleKey, string>;
type Pending = [key: RoleKey, roleId: string];
type RoleCheck = { grantable: Map<RoleKey, string>; problems: string[] };

export type RolesOptions = {
	guildId: string;
	/** The bot's guilds, of which it fetches `guildId`. */
	guilds: RolesGuilds;
	contributors: ContributorCache;
	/** The role id of each role's id constant. */
	ids: Readonly<Record<RoleConstant, string>>;
	/** The clock, in epoch milliseconds. */
	now: () => number;
};

const DELETED_RETRY_MS = 60 * 60 * 1000;
const ALL_MEMBERS: MemberQuery = { by: 'all' };
// The subjects the bot's triggers write into `member_changed` payloads.
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
	if (row.githubId === null) {
		return new Set();
	}

	return new Set(
		ROLES.filter((role) => role.qualifies(row, contributors)).map((role) => role.key),
	);
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

/**
 * @description Creates the grant-only role-sync dispatcher.
 * @param options The guild, the contributor cache, the role ids and the clock.
 * @returns The `member_changed` dispatcher.
 */
export function createRolesDispatcher(options: RolesOptions): Dispatcher {
	const { guildId, guilds, contributors, ids, now } = options;
	const allRoles: Grantable = new Map(ROLES.map(({ key, constant }) => [key, ids[constant]]));
	// `discordId:roleId` pairs seen held by hand; per process, so a restart checks them once more.
	const held = new Set<string>();
	// Discord id -> epoch ms before which a deleted account is not fetched again; one not in the guild is retried every run.
	const deleted = new Map<string, number>();
	let reported = new Set<string>();

	async function loadClaims(
		{ db, web }: DispatcherContext,
		query: MemberQuery,
	): Promise<Claim[]> {
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

		for (const { key, constant } of ROLES) {
			const roleId = ids[constant];
			const role = guild.roles.cache.get(roleId);

			if (!role) {
				problems.push(
					`Cannot grant ${key}: role ${constant}=${roleId} does not exist in guild ${guildId}. Fix it in ${IDS_SOURCE}.`,
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
			const failure = discordFailure(error);

			// The account exists but is not in the guild; any other missing resource is an error.
			if (failure === 'unknown-member') {
				logger.debug(
					`Discord user ${claim.discordId} is not in the guild; retrying on the next reconcile.`,
				);

				return;
			}

			// 10013 Unknown User: the account was deleted.
			if (failure === 'undeliverable') {
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
				if (discordFailure(error) !== 'forbidden') {
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

	async function sync(current: DispatcherContext, query: MemberQuery) {
		const claims = await loadClaims(current, query);

		if (!claims.length) return;

		const guild = await guilds.fetch(guildId);
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

	// The bot runs without the privileged GuildMembers intent, so the timed reconcile grants joins.
	return {
		name: 'roles',
		channel: 'member_changed',
		reconcile: (current) => sync(current, ALL_MEMBERS),
		handle(payload, current) {
			const query = parseMemberPayload(payload);

			if (!query) {
				return Promise.resolve();
			}

			return sync(current, query);
		},
	};
}

export default { parseMemberPayload, createRolesDispatcher, qualifyingRoles };
