import type { AddonType } from '@unbound-app/contracts/addons';
import { addonAuthorSchema } from '@unbound-app/contracts/manifest';
import { z } from 'zod';

import { isIdentified, loadAuthors, type IdentifiedAuthor } from '~/lib/authors/resolve';
import type { DiscordId } from '~/lib/authors/discord-users';
import { AUTHOR_PAGE_SIZE } from '~/lib/addon-filters';
import { listListedAddons } from '~/lib/addons';
import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';

/** One author in the filter menu. */
export type AuthorOption = {
	/** The Discord id manifests credit them by, which the listing's `authors` filter takes. */
	id: DiscordId;
	name: string;
	avatarUrl: string;
	/** Listed addons of the type whose newest version credits them. */
	count: number;
};

export type AuthorPage = {
	/** Most addons first, then by name and id. Stable across pages. */
	authors: AuthorOption[];
	/** `null` on the last page. */
	nextCursor: string | null;
	/** How many authors match in all, loaded or not. */
	total: number;
};

export type AuthorSearch = {
	/** Counts and keeps only addons of this type; every type when omitted. */
	type?: AddonType;
	/** Case-insensitive match on the shown name or any name a manifest credits them by. */
	q?: string;
	/** Keeps only these authors, such as the ones a filter already picked. */
	ids?: string[];
	/** The previous page's `nextCursor`. */
	cursor?: string;
};

type Entry = {
	author: IdentifiedAuthor;
	aliases: Set<string>;
	count: number;
};

type SortKey = [count: number, name: string, discordId: DiscordId];

const CURSOR = z.tuple([z.number().int(), z.string(), addonAuthorSchema.shape.id]);

async function loadEntries(ctx: AppContext, type: AddonType | undefined): Promise<Entry[]> {
	const listed = (await listListedAddons(ctx)).filter((entry) => !type || entry.type === type);
	const resolve = await loadAuthors(
		ctx,
		listed.map((entry) => entry.latestVersion.manifest.authors),
	);
	const entries = new Map<DiscordId, Entry>();

	for (const { latestVersion } of listed) {
		// The resolver credits each author once per addon, so the count is of addons.
		for (const author of resolve(latestVersion.manifest.authors).filter(isIdentified)) {
			const entry = entries.get(author.discordId) ?? { author, aliases: new Set(), count: 0 };

			entry.count += 1;
			entries.set(author.discordId, entry);
		}

		for (const author of latestVersion.manifest.authors) {
			entries.get(author.id)?.aliases.add(author.name);
		}
	}

	return [...entries.values()];
}

function matches(entry: Entry, needle: string): boolean {
	return [entry.author.name, ...entry.aliases].some((name) =>
		name.toLowerCase().includes(needle),
	);
}

function sortKey(entry: Entry): SortKey {
	return [entry.count, entry.author.name, entry.author.discordId];
}

function compareKeys([countA, nameA, idA]: SortKey, [countB, nameB, idB]: SortKey): number {
	return (
		countB - countA ||
		nameA.localeCompare(nameB, 'en', { sensitivity: 'base' }) ||
		idA.localeCompare(idB)
	);
}

function decodeCursor(cursor: string): SortKey {
	try {
		return CURSOR.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
	} catch {
		throw new ApiError('invalid_request', 'The cursor does not belong to this list.');
	}
}

/**
 * @description Searches the authors credited by the newest version of a listed addon, one page at a time.
 * @param ctx The application context.
 * @param search The type, name search, picked ids and the cursor to page from.
 * @returns The page, the cursor of the next one and how many authors match.
 */
export async function searchAuthors(ctx: AppContext, search: AuthorSearch): Promise<AuthorPage> {
	const needle = search.q?.trim().toLowerCase() ?? '';
	const ids = search.ids ? new Set<string>(search.ids) : undefined;
	const after = search.cursor ? decodeCursor(search.cursor) : undefined;
	const found = (await loadEntries(ctx, search.type))
		.filter((entry) => !ids || ids.has(entry.author.discordId))
		.filter((entry) => !needle || matches(entry, needle))
		.toSorted((a, b) => compareKeys(sortKey(a), sortKey(b)));
	const rest = after ? found.filter((entry) => compareKeys(sortKey(entry), after) > 0) : found;
	const page = rest.slice(0, AUTHOR_PAGE_SIZE);
	const last = page.at(-1);

	return {
		authors: page.map(({ author, count }) => ({
			id: author.discordId,
			name: author.name,
			avatarUrl: author.avatarUrl,
			count,
		})),
		nextCursor:
			rest.length > AUTHOR_PAGE_SIZE && last
				? Buffer.from(JSON.stringify(sortKey(last))).toString('base64url')
				: null,
		total: found.length,
	};
}

export default { searchAuthors };
