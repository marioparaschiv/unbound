import { and, eq } from 'drizzle-orm';

import { account, teamMember } from '~/db/schema';
import type { Database } from '~/db/database';

/**
 * @description Checks whether a user's linked Discord account is in the development team, as the
 * last team sync saw it. No site role grants this, so no role change can either.
 * @param db The database.
 * @param userId The user.
 * @returns Whether they are in the development team.
 */
export async function isDevelopmentTeam(db: Database, userId: string): Promise<boolean> {
	const [row] = await db
		.select({ discordId: teamMember.discordId })
		.from(account)
		.innerJoin(teamMember, eq(teamMember.discordId, account.accountId))
		.where(
			and(
				eq(account.providerId, 'discord'),
				eq(account.userId, userId),
				eq(teamMember.group, 'development-team'),
			),
		)
		.limit(1);

	return Boolean(row);
}

export default { isDevelopmentTeam };
