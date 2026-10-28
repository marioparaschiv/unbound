import { and, eq, isNotNull } from 'drizzle-orm';

import { STAFF_ROLES, type StaffRole } from '~/lib/team/roles';
import { setRoleWithRecord } from '~/lib/moderation-events';
import { account, teamMember, user } from '~/db/schema';
import { DEFAULT_ROLE } from '~/lib/auth/access';
import type { Database } from '~/db/database';

export type RoleChange = {
	userId: string;
	from: string;
	to: string;
};

type LinkedRole = {
	userId: string;
	role: string;
	staffRole: StaffRole | null;
};

/**
 * @description Decides the role a Discord-linked user should hold. The sync only grants: a staff role
 * set by hand, or one Discord no longer grants, is kept. CI accounts never change.
 * @param linked The user's current role and the staff role their Discord roles grant.
 * @returns The role they should hold.
 */
export function targetRole(linked: LinkedRole): string {
	const { role, staffRole } = linked;
	const names = role.split(',').map((name) => name.trim());

	if (!staffRole || names.includes('ci')) {
		return role;
	}

	// STAFF_ROLES is highest first, so this is the granted role or one above it.
	const atLeast = STAFF_ROLES.slice(0, STAFF_ROLES.indexOf(staffRole) + 1);

	return atLeast.some((name) => names.includes(name)) ? role : staffRole;
}

async function applyRoles(db: Database, linked: LinkedRole[], at: Date) {
	const changes: RoleChange[] = [];

	for (const entry of linked) {
		const to = targetRole(entry);

		if (to === entry.role) {
			continue;
		}

		await setRoleWithRecord(db, entry.userId, to, { actorId: null, at });
		changes.push({ userId: entry.userId, from: entry.role, to });
	}

	return changes;
}

async function readLinkedRoles(db: Database, userId?: string): Promise<LinkedRole[]> {
	const rows = await db
		.select({ userId: user.id, role: user.role, staffRole: teamMember.staffRole })
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.innerJoin(teamMember, eq(teamMember.discordId, account.accountId))
		.where(
			and(
				eq(account.providerId, 'discord'),
				isNotNull(teamMember.staffRole),
				userId ? eq(account.userId, userId) : undefined,
			),
		)
		.orderBy(user.id);

	return rows.map((row) => ({ ...row, role: row.role ?? DEFAULT_ROLE }));
}

/**
 * @description Grants every Discord-linked user the staff role the team snapshot names for them, unless
 * they already hold it or a higher one. Each change is recorded as `user.role_set` by the system.
 * @param db The database.
 * @param at The time to record.
 * @returns The changes made; empty when every role already matches.
 */
export async function reconcileSiteRoles(db: Database, at: Date): Promise<RoleChange[]> {
	return applyRoles(db, await readLinkedRoles(db), at);
}

/**
 * @description Grants a user who just linked their Discord account the staff role the team snapshot
 * names for it, so staff get their role on first sign-in.
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
	const [change] = await applyRoles(db, await readLinkedRoles(db, userId), at);

	return change;
}

export default { targetRole, reconcileSiteRoles, grantTeamRole };
