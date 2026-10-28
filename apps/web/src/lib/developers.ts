import { isIdentified, loadAuthors, type IdentifiedAuthor } from '~/lib/authors/resolve';
import { toMarketplaceAddon, type MarketplaceAddon } from '~/lib/marketplace-addon';
import { compareGroups, TEAM_GROUPS, type TeamGroup } from '~/lib/team/roles';
import type { DiscordId } from '~/lib/authors/discord-users';
import { readTeamGroups } from '~/lib/team/snapshot';
import { listListedAddons } from '~/lib/addons';
import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import { addonAuthorSchema } from '@unbound-app/contracts/manifest';
import { z } from 'zod';

export type { TeamGroup } from '~/lib/team/roles';

export type DevelopersQuery = {
	/** Case-insensitive name/alias match; empty for all. */
	search: string;
	/** Opaque cursor from the previous page's `nextCursor`; absent for the first page. */
	cursor?: string;
};

export type Developer = {
	author: IdentifiedAuthor;
	/** Listed addons crediting them; 0 for team members with none. */
	addonCount: number;
	group: TeamGroup;
};

export type DevelopersPage = {
	/** Sorted by group order, then name (localeCompare 'en', sensitivity base), then discordId. Stable across pages. */
	developers: Developer[];
	/** `null` on the last page. */
	nextCursor: string | null;
};

export type DeveloperProfile = {
	author: IdentifiedAuthor;
	addons: MarketplaceAddon[];
	group: TeamGroup;
};

type Person = DeveloperProfile & {
	aliases: Set<string>;
};

type SortKey = [group: TeamGroup, name: string, discordId: DiscordId];

const CURSOR = z.tuple([z.enum(TEAM_GROUPS), z.string(), addonAuthorSchema.shape.id]);

async function loadPeople(ctx: AppContext): Promise<Map<DiscordId, Person>> {
	const [listed, team] = await Promise.all([listListedAddons(ctx), readTeamGroups(ctx)]);
	// A team member's own entry, for those no listed addon credits; the id doubles as the fallback name.
	const teamAuthors = [...team.keys()].map((id) => ({ name: id, id }));
	const resolve = await loadAuthors(ctx, [
		...listed.map((entry) => entry.latestVersion.manifest.authors),
		teamAuthors,
	]);
	const people = new Map<DiscordId, Person>();

	for (const entry of listed) {
		const card = toMarketplaceAddon(entry, entry.latestVersion, resolve);

		for (const author of card.authors.filter(isIdentified)) {
			const person = people.get(author.discordId) ?? {
				author,
				aliases: new Set(),
				addons: [],
				group: team.get(author.discordId) ?? 'addon-developer',
			};

			person.addons.push(card);
			people.set(author.discordId, person);
		}

		for (const author of entry.latestVersion.manifest.authors) {
			people.get(author.id)?.aliases.add(author.name);
		}
	}

	for (const author of resolve(teamAuthors).filter(isIdentified)) {
		const group = team.get(author.discordId);

		if (group && !people.has(author.discordId)) {
			people.set(author.discordId, { author, aliases: new Set(), addons: [], group });
		}
	}

	return people;
}

function matches(person: Person, search: string): boolean {
	const needle = search.toLowerCase();

	return [person.author.name, ...person.aliases].some((name) =>
		name.toLowerCase().includes(needle),
	);
}

function sortKey(person: Person): SortKey {
	return [person.group, person.author.name, person.author.discordId];
}

function compareKeys([groupA, nameA, idA]: SortKey, [groupB, nameB, idB]: SortKey): number {
	return (
		compareGroups(groupA, groupB) ||
		nameA.localeCompare(nameB, 'en', { sensitivity: 'base' }) ||
		idA.localeCompare(idB)
	);
}

function encodeCursor(key: SortKey): string {
	return Buffer.from(JSON.stringify(key)).toString('base64url');
}

function decodeCursor(cursor: string): SortKey {
	try {
		return CURSOR.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
	} catch {
		throw new ApiError('invalid_request', 'The cursor does not belong to this list.');
	}
}

/**
 * @description Lists one page of the Team: everyone holding a team role in the Unbound Discord, then
 * the other Discord ids credited by the newest version of a listed addon.
 * @param ctx The application context.
 * @param query The name filter and the cursor to page from.
 * @returns The page, in group then name order, and the cursor of the next one.
 */
export async function listDevelopers(
	ctx: AppContext,
	query: DevelopersQuery,
): Promise<DevelopersPage> {
	const pageSize = ctx.env.DEVELOPER_LIST_PAGE_SIZE;
	const after = query.cursor ? decodeCursor(query.cursor) : undefined;
	const found = [...(await loadPeople(ctx)).values()]
		.filter((person) => !query.search || matches(person, query.search))
		.filter((person) => !after || compareKeys(sortKey(person), after) > 0)
		.toSorted((a, b) => compareKeys(sortKey(a), sortKey(b)));
	const page = found.slice(0, pageSize);
	const last = page.at(-1);

	return {
		developers: page.map((person) => ({
			author: person.author,
			addonCount: person.addons.length,
			group: person.group,
		})),
		nextCursor: found.length > pageSize && last ? encodeCursor(sortKey(last)) : null,
	};
}

/**
 * @description Loads a developer's public page.
 * @param ctx The application context.
 * @param discordId The developer's Discord id.
 * @returns The developer, their group and their listed addons, or `undefined` when they are neither on
 * the team nor credited by a listed addon.
 */
export async function getDeveloper(
	ctx: AppContext,
	discordId: DiscordId,
): Promise<DeveloperProfile | undefined> {
	const person = (await loadPeople(ctx)).get(discordId);

	if (!person) return;

	return { author: person.author, addons: person.addons, group: person.group };
}

export default { listDevelopers, getDeveloper };
