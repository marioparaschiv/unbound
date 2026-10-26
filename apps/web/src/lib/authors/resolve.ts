import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { PublicBadge } from '@unbound-app/contracts/sponsors';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { isStale, readProfiles, requestProfileRefresh } from '~/lib/authors/profiles';
import { getAvatarUrl, getDefaultAvatarUrl } from '~/lib/discord';
import type { CachedProfile } from '~/lib/authors/profiles';
import type { DiscordId } from '~/lib/authors/discord-users';
import { getVisibleBadges } from '~/lib/sponsors/badges';
import { DEFAULT_ROLE } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';
import { isBanned } from '~/lib/api/caller';
import { account, user } from '~/db/schema';

export type ManifestAuthor = PublishedManifest['authors'][number];

type AuthorFace = {
	/** What to print. */
	name: string;
	/** Falls back to Discord's default avatar for the id. */
	avatarUrl: string;
};

/** A manifest author, resolved for display. Only `user` links to a profile page. */
export type ResolvedAuthor =
	| (AuthorFace & {
			kind: 'user';
			discordId: DiscordId;
			userId: string;
			role: string;
			badge: PublicBadge | null;
			/** When the Unbound account was created, as an ISO string. */
			memberSince: string;
	  })
	| (AuthorFace & { kind: 'discord'; discordId: DiscordId; username: string })
	/** `discordId` is null when the manifest id is `'0'`. */
	| (AuthorFace & { kind: 'manifest'; discordId: DiscordId | null });

/** An author with a real Discord id: what `/developers` lists. */
export type IdentifiedAuthor = ResolvedAuthor & { discordId: DiscordId };

/** Resolves one manifest's authors, dropping repeats. Pure: ids it was not loaded for get the manifest tier. */
export type AuthorResolver = (authors: ManifestAuthor[]) => ResolvedAuthor[];

type LinkedUser = typeof user.$inferSelect & { badge: PublicBadge | null };

/**
 * @description Narrows a resolved author to one with a Discord id.
 * @param author The author.
 * @returns Whether the manifest gave a real id.
 */
export function isIdentified(author: ResolvedAuthor): author is IdentifiedAuthor {
	return author.discordId !== null;
}

function pickAuthor(
	author: ManifestAuthor,
	linked: LinkedUser | undefined,
	cached: CachedProfile | undefined,
): ResolvedAuthor {
	if (author.id === '0') {
		return {
			kind: 'manifest',
			discordId: null,
			name: author.name,
			avatarUrl: getDefaultAvatarUrl('0'),
		};
	}

	const found = cached?.kind === 'found' ? cached.user : undefined;
	const discordAvatarUrl = found?.avatarHash
		? getAvatarUrl(author.id, found.avatarHash)
		: getDefaultAvatarUrl(author.id);

	if (linked) {
		return {
			kind: 'user',
			discordId: author.id,
			userId: linked.id,
			name: linked.name,
			avatarUrl: linked.image ?? discordAvatarUrl,
			role: linked.role ?? DEFAULT_ROLE,
			badge: linked.badge,
			memberSince: linked.createdAt.toISOString(),
		};
	}

	if (found) {
		return {
			kind: 'discord',
			discordId: author.id,
			username: found.username,
			// An empty display name falls through to the username, as Discord shows it.
			name: found.globalName || found.username,
			avatarUrl: discordAvatarUrl,
		};
	}

	return {
		kind: 'manifest',
		discordId: author.id,
		name: author.name,
		avatarUrl: discordAvatarUrl,
	};
}

// A banned user falls through to the Discord tier. The oldest link wins if two users claim one id.
async function readLinkedUsers(
	ctx: AppContext,
	ids: DiscordId[],
): Promise<Map<string, LinkedUser>> {
	const linked = new Map<string, LinkedUser>();

	if (ids.length === 0) {
		return linked;
	}

	const rows = await ctx.db
		.select({ discordId: account.accountId, user })
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.where(and(eq(account.providerId, 'discord'), inArray(account.accountId, ids)))
		.orderBy(asc(account.createdAt));

	const now = ctx.now();
	const active = rows.filter((row) => !isBanned(row.user, now));
	const badges = await getVisibleBadges(
		ctx,
		active.map((row) => row.user.id),
	);

	for (const row of active) {
		if (!linked.has(row.discordId)) {
			linked.set(row.discordId, { ...row.user, badge: badges.get(row.user.id) ?? null });
		}
	}

	return linked;
}

function authorKey(author: ManifestAuthor): string {
	return author.id === '0' ? `0:${author.name}` : author.id;
}

/**
 * @description Loads everything needed to resolve the given manifests' authors, and asks for a
 * Discord refresh when any profile is missing or stale. Never waits on Discord.
 * @param ctx The application context.
 * @param lists The authors of each manifest that will be resolved.
 * @returns A pure resolver: linked Unbound user, else cached Discord profile, else the manifest name.
 */
export async function loadAuthors(
	ctx: AppContext,
	lists: ManifestAuthor[][],
): Promise<AuthorResolver> {
	const ids = [
		...new Set(lists.flat().flatMap((author) => (author.id === '0' ? [] : [author.id]))),
	];
	const [linked, cached] = await Promise.all([readLinkedUsers(ctx, ids), readProfiles(ctx, ids)]);

	if (ids.some((id) => isStale(ctx, cached.get(id)))) {
		requestProfileRefresh();
	}

	return (authors) => {
		const unique = new Map(authors.map((author) => [authorKey(author), author]));

		return [...unique.values()].map((author) =>
			pickAuthor(author, linked.get(author.id), cached.get(author.id)),
		);
	};
}

export default { isIdentified, loadAuthors };
