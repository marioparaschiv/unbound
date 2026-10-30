import { eq } from 'drizzle-orm';

import { account, teamMember } from '~/db/schema';
import { listListedAddons } from '~/lib/addons';
import type { AppContext } from '~/lib/context';
import type { DiscordId } from '~/db/schema';

/**
 * @description Collects the Discord ids the team sync looks up: the team snapshot (where staff add
 * people by hand), every Discord-linked user and every author a listed addon credits.
 * @param ctx The application context.
 * @returns The distinct ids.
 */
export async function readCandidateIds(ctx: AppContext): Promise<Set<DiscordId>> {
	const [snapshot, linked, listed] = await Promise.all([
		ctx.db.select({ id: teamMember.discordId }).from(teamMember),
		ctx.db
			.select({ id: account.accountId })
			.from(account)
			.where(eq(account.providerId, 'discord')),
		listListedAddons(ctx),
	]);
	// `0` marks an author with no Discord account.
	const authors = listed.flatMap((entry) =>
		entry.latestVersion.manifest.authors.map((author) => author.id).filter((id) => id !== '0'),
	);

	return new Set<DiscordId>([
		...snapshot.map((row) => row.id),
		...linked.map((row) => row.id).filter(isDiscordId),
		...authors,
	]);
}

function isDiscordId(id: string): id is DiscordId {
	return /^\d+$/.test(id);
}

export default { readCandidateIds };
