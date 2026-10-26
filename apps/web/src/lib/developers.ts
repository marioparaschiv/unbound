import type { IdentifiedAuthor } from '~/lib/authors/resolve';
import type { MarketplaceAddon } from '~/lib/marketplace-addon';
import type { DiscordId } from '~/lib/authors/discord-users';
import { isIdentified, loadAuthors } from '~/lib/authors/resolve';
import { toMarketplaceAddon } from '~/lib/marketplace-addon';
import type { AppContext } from '~/lib/context';
import { listListedAddons } from '~/lib/addons';

export type DevelopersQuery = {
	/** Matches anywhere in the developer's name or a manifest name for them, case-insensitively. */
	search: string;
	/** 1-based. */
	page: number;
};

export type Developer = {
	author: IdentifiedAuthor;
	/** Listed addons whose newest version credits this author. */
	addonCount: number;
};

export type DevelopersPage = {
	developers: Developer[];
	total: number;
	pageSize: number;
};

export type DeveloperProfile = {
	author: IdentifiedAuthor;
	/** The listed addons whose newest version credits this author, by id. */
	addons: MarketplaceAddon[];
};

type Credit = DeveloperProfile & {
	/** Every name a manifest gives this author, so a search finds them by any of them. */
	aliases: Set<string>;
};

// Reads the whole catalog: at hundreds of listed addons this beats keeping an author index in sync.
async function loadCredits(ctx: AppContext): Promise<Map<DiscordId, Credit>> {
	const listed = await listListedAddons(ctx);
	const resolve = await loadAuthors(
		ctx,
		listed.map((entry) => entry.latestVersion.manifest.authors),
	);
	const credits = new Map<DiscordId, Credit>();

	for (const entry of listed) {
		const card = toMarketplaceAddon(entry, entry.latestVersion, resolve);

		for (const author of card.authors.filter(isIdentified)) {
			const credit = credits.get(author.discordId) ?? {
				author,
				aliases: new Set(),
				addons: [],
			};

			credit.addons.push(card);
			credits.set(author.discordId, credit);
		}

		for (const author of entry.latestVersion.manifest.authors) {
			credits.get(author.id)?.aliases.add(author.name);
		}
	}

	return credits;
}

function matches(credit: Credit, search: string): boolean {
	const needle = search.toLowerCase();

	return [credit.author.name, ...credit.aliases].some((name) =>
		name.toLowerCase().includes(needle),
	);
}

function byName(a: Credit, b: Credit): number {
	return (
		a.author.name.localeCompare(b.author.name, 'en', { sensitivity: 'base' }) ||
		a.author.discordId.localeCompare(b.author.discordId)
	);
}

/**
 * @description Lists one page of developers: the distinct Discord ids credited by the newest version
 * of a listed addon, ordered by resolved name.
 * @param ctx The application context.
 * @param query The name filter and page number.
 * @returns The page, the total number of matching developers and the page size.
 */
export async function listDevelopers(
	ctx: AppContext,
	query: DevelopersQuery,
): Promise<DevelopersPage> {
	const pageSize = ctx.env.DEVELOPER_LIST_PAGE_SIZE;
	const credits = [...(await loadCredits(ctx)).values()];
	const found = query.search
		? credits.filter((credit) => matches(credit, query.search))
		: credits;
	const start = (query.page - 1) * pageSize;

	return {
		developers: found
			.toSorted(byName)
			.slice(start, start + pageSize)
			.map((credit) => ({ author: credit.author, addonCount: credit.addons.length })),
		total: found.length,
		pageSize,
	};
}

/**
 * @description Loads a developer's public page.
 * @param ctx The application context.
 * @param discordId The developer's Discord id.
 * @returns The developer and their listed addons, or `undefined` when no listed addon credits the id.
 */
export async function getDeveloper(
	ctx: AppContext,
	discordId: DiscordId,
): Promise<DeveloperProfile | undefined> {
	const credit = (await loadCredits(ctx)).get(discordId);

	if (!credit) return;

	return { author: credit.author, addons: credit.addons };
}

export default { listDevelopers, getDeveloper };
