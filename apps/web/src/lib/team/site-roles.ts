import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { account, addon, addonMaintainer, teamMember, user } from '~/db/schema';
import { STAFF_ROLES, type StaffRole } from '~/lib/team/roles';
import { setRoleWithRecord } from '~/lib/moderation-events';
import { DEFAULT_ROLE } from '~/lib/auth/access';
import type { Database } from '~/db/database';

export type SiteRolePlan = {
	/** Whether a staff role Discord no longer grants is taken away; off under the lockout guard. */
	demote: boolean;
	at: Date;
};

export type RoleChange = {
	userId: string;
	from: string;
	to: string;
};

type LinkedRole = {
	userId: string;
	role: string;
	staffRole: StaffRole | null;
	maintainsListedAddon: boolean;
};

function roleNames(role: string): string[] {
	return role.split(',').map((name) => name.trim());
}

function isStaffRole(name: string): name is StaffRole {
	return STAFF_ROLES.some((role) => role === name);
}

/**
 * @description Decides the role a Discord-linked user should hold: the staff role their Discord roles
 * grant, else a staff role they lost falls back to `developer` or `user`. CI accounts never change.
 * @param linked The user's current role, granted staff role and whether they maintain a listed addon.
 * @param demote Whether a lost staff role is taken away.
 * @returns The role they should hold.
 */
export function targetRole(linked: LinkedRole, demote: boolean): string {
	const names = roleNames(linked.role);

	if (names.includes('ci')) {
		return linked.role;
	}

	if (linked.staffRole) {
		return linked.staffRole;
	}

	if (!demote || !names.some(isStaffRole)) {
		return linked.role;
	}

	// The role a listing approval would have left them with.
	return linked.maintainsListedAddon ? 'developer' : DEFAULT_ROLE;
}

async function readListedMaintainers(db: Database, userIds: string[]): Promise<Set<string>> {
	if (userIds.length === 0) {
		return new Set();
	}

	const rows = await db
		.selectDistinct({ userId: addonMaintainer.userId })
		.from(addonMaintainer)
		.innerJoin(addon, eq(addon.id, addonMaintainer.addonId))
		.where(and(inArray(addonMaintainer.userId, userIds), isNull(addon.delistedAt)));

	return new Set(rows.map((row) => row.userId));
}

async function applyRoles(db: Database, linked: LinkedRole[], plan: SiteRolePlan) {
	const changes: RoleChange[] = [];

	for (const entry of linked) {
		const to = targetRole(entry, plan.demote);

		if (to === entry.role) {
			continue;
		}

		await setRoleWithRecord(db, entry.userId, to, { actorId: null, at: plan.at });
		changes.push({ userId: entry.userId, from: entry.role, to });
	}

	return changes;
}

/**
 * @description Brings every Discord-linked user's staff role in line with the team snapshot: grants
 * the role it names and, when the plan allows, takes away one it no longer names. Each change is
 * recorded as `user.role_set` by the system.
 * @param db The database.
 * @param plan Whether to demote, and the time to record.
 * @returns The changes made; empty when every role already matches.
 */
export async function reconcileSiteRoles(db: Database, plan: SiteRolePlan): Promise<RoleChange[]> {
	const rows = await db
		.select({ userId: user.id, role: user.role, staffRole: teamMember.staffRole })
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.leftJoin(teamMember, eq(teamMember.discordId, account.accountId))
		.where(
			and(
				eq(account.providerId, 'discord'),
				or(inArray(user.role, STAFF_ROLES), inArray(teamMember.staffRole, STAFF_ROLES)),
			),
		)
		.orderBy(user.id);
	const maintainers = await readListedMaintainers(
		db,
		rows.map((row) => row.userId),
	);

	return applyRoles(
		db,
		rows.map((row) => ({
			userId: row.userId,
			role: row.role ?? DEFAULT_ROLE,
			staffRole: row.staffRole,
			maintainsListedAddon: maintainers.has(row.userId),
		})),
		plan,
	);
}

/**
 * @description Grants a user who just linked their Discord account the staff role the team snapshot
 * names for it, so staff get their role on first sign-in. Never demotes.
 * @param db The database.
 * @param userId The user.
 * @param at The time to record.
 * @returns The change made, or `undefined` when none was needed.
 */
export async function grantTeamRole(
	db: Database,
	userId: string,
	at: Date,
): Promise<RoleChange | undefined> {
	const [row] = await db
		.select({ role: user.role, staffRole: teamMember.staffRole })
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.innerJoin(teamMember, eq(teamMember.discordId, account.accountId))
		.where(and(eq(account.providerId, 'discord'), eq(account.userId, userId)))
		.limit(1);

	if (!row?.staffRole) return;

	const [change] = await applyRoles(
		db,
		[
			{
				userId,
				role: row.role ?? DEFAULT_ROLE,
				staffRole: row.staffRole,
				maintainsListedAddon: false,
			},
		],
		{ demote: false, at },
	);

	return change;
}

export default { targetRole, reconcileSiteRoles, grantTeamRole };
