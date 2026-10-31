import { addonAuthorSchema } from '@unbound-app/contracts/manifest';
import { z } from 'zod';

import { isIdentified, loadAuthors, type IdentifiedAuthor } from '~/lib/authors/resolve';
import { toMarketplaceAddon, type MarketplaceAddon } from '~/lib/marketplace-addon';
import { readTeamMembers, type TeamMemberRow } from '~/lib/team/snapshot';
import type { DiscordId, StaffRole, TeamGroup } from '~/db/schema';
import { getBannerUrl, getGuildBannerUrl } from '~/lib/discord';
import { decodeCursor, encodeCursor } from '~/lib/keyset';
import { readProfiles } from '~/lib/authors/profiles';
import { compareGroups } from '~/lib/team/roles';
import { listListedAddons } from '~/lib/addons';
import type { AppContext } from '~/lib/context';
import { TEAM_GROUPS } from '~/db/team-groups';

export type { TeamGroup } from '~/db/schema';

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
	/** Sorted by group, then staff role (admin before moderator), then manual position, then name, then discordId. Stable across pages. */
	developers: Developer[];
	/** `null` on the last page. */
	nextCursor: string | null;
};

export type DeveloperProfile = {
	author: IdentifiedAuthor;
	addons: MarketplaceAddon[];
	group: TeamGroup;
};

export type DeveloperPage = DeveloperProfile & {
	/** Their Unbound guild banner, else their Discord profile banner; `null` when they have neither. */
	bannerUrl: string | null;
};

/** Where a person sits within their group: their staff role's rank, then their manual position. */
type Order = { staff: number; position: number };

type Person = DeveloperProfile & {
	aliases: Set<string>;
	order: Order;
};

type SortKey = [
	group: TeamGroup,
	staff: number,
	position: number,
	name: string,
	discordId: DiscordId,
];

const CURSOR = z.tuple([
	z.enum(TEAM_GROUPS),
	z.number().int(),
	z.number().int(),
	z.string(),
	addonAuthorSchema.shape.id,
]);

const STAFF_RANK: Record<StaffRole, number> = { admin: 0, moderator: 1 };
// Below every staff role, so the rest of a group sorts after the staff.
const UNSTAFFED_RANK = 2;
// Sorts a person with no manual position after everyone who has one.
const UNPOSITIONED = 2_147_483_647;

function orderOf(member: TeamMemberRow | undefined): Order {
	return {
		staff: member?.staffRole ? STAFF_RANK[member.staffRole] : UNSTAFFED_RANK,
		position: member?.position ?? UNPOSITIONED,
	};
}

async function readBannerUrl(ctx: AppContext, discordId: DiscordId): Promise<string | null> {
	const profile = (await readProfiles(ctx, [discordId])).get(discordId);

	if (profile?.kind !== 'found') {
		return null;
	}

	if (profile.guildBannerHash) {
		return getGuildBannerUrl(ctx.env.DISCORD_GUILD_ID, discordId, profile.guildBannerHash);
	}

	return profile.user.bannerHash ? getBannerUrl(discordId, profile.user.bannerHash) : null;
}

async function loadPeople(ctx: AppContext): Promise<Map<DiscordId, Person>> {
	const [listed, team] = await Promise.all([listListedAddons(ctx), readTeamMembers(ctx)]);
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
				group: team.get(author.discordId)?.group ?? 'addon-developer',
				order: orderOf(team.get(author.discordId)),
			};

			person.addons.push(card);
			people.set(author.discordId, person);
		}

		for (const author of entry.latestVersion.manifest.authors) {
			people.get(author.id)?.aliases.add(author.name);
		}
	}

	for (const author of resolve(teamAuthors).filter(isIdentified)) {
		const member = team.get(author.discordId);

		if (member && !people.has(author.discordId)) {
			people.set(author.discordId, {
				author,
				aliases: new Set(),
				addons: [],
				group: member.group,
				order: orderOf(member),
			});
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
	return [
		person.group,
		person.order.staff,
		person.order.position,
		person.author.name,
		person.author.discordId,
	];
}

function compareKeys(
	[groupA, staffA, positionA, nameA, idA]: SortKey,
	[groupB, staffB, positionB, nameB, idB]: SortKey,
): number {
	return (
		compareGroups(groupA, groupB) ||
		staffA - staffB ||
		positionA - positionB ||
		nameA.localeCompare(nameB, 'en', { sensitivity: 'base' }) ||
		idA.localeCompare(idB)
	);
}

/**
 * @description Lists one page of the Team: everyone holding a team role in the Unbound Discord, then
 * the other Discord ids credited by the newest version of a listed addon.
 * @param ctx The application context.
 * @param query The name filter and the cursor to page from.
 * @returns The page, in group, staff role, position then name order, and the cursor of the next one.
 */
export async function listDevelopers(
	ctx: AppContext,
	query: DevelopersQuery,
): Promise<DevelopersPage> {
	const pageSize = ctx.env.DEVELOPER_LIST_PAGE_SIZE;
	const after = query.cursor ? decodeCursor(query.cursor, CURSOR) : undefined;
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
 * @returns The developer, their group, banner and listed addons, or `undefined` when they are neither
 * on the team nor credited by a listed addon.
 */
export async function getDeveloper(
	ctx: AppContext,
	discordId: DiscordId,
): Promise<DeveloperPage | undefined> {
	const [people, bannerUrl] = await Promise.all([loadPeople(ctx), readBannerUrl(ctx, discordId)]);
	const person = people.get(discordId);

	if (!person) return;

	return { author: person.author, addons: person.addons, group: person.group, bannerUrl };
}

export default { listDevelopers, getDeveloper };
