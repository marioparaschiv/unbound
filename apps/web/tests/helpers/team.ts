import type { DiscordId, DiscordTeamGroup } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import { teamMember } from '~/db/schema';

// The sync replaces this with the group their Discord roles grant.
const PLACEHOLDER_GROUP: DiscordTeamGroup = 'contributor';

function isDiscordId(id: string): id is DiscordId {
	return /^\d+$/.test(id);
}

/**
 * @description Adds people to the team snapshot the way staff do by hand, so the next sync looks them up.
 * @param ctx The application context.
 * @param ids Their Discord ids.
 * @returns Resolves once they are added; the sync corrects each group from their Discord roles.
 */
export async function addTeamMembers(ctx: AppContext, ids: string[]): Promise<void> {
	const valid = ids.filter(isDiscordId);

	if (valid.length !== ids.length) {
		throw new Error('Every team member id must be a Discord snowflake.');
	}

	await ctx.db
		.insert(teamMember)
		.values(
			valid.map((discordId) => ({
				discordId,
				group: PLACEHOLDER_GROUP,
				syncedAt: ctx.now(),
			})),
		)
		.onConflictDoNothing();
}

export default { addTeamMembers };
