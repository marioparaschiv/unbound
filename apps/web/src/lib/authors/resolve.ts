import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { PublicBadge } from '@unbound-app/contracts/sponsors';
import { and, asc, eq, inArray } from 'drizzle-orm';

import {
	isStale,
	readProfiles,
	requestProfileRefresh,
	type CachedProfile,
} from '~/lib/authors/profiles';
import { getAvatarUrl, getDefaultAvatarUrl, isDiscordId } from '~/lib/discord';
import { getVisibleBadges } from '~/lib/sponsors/badges';
import { DEFAULT_ROLE } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';
import type { DiscordId } from '~/db/schema';
import { account, user } from '~/db/schema';
import { isBanned } from '~/lib/api/caller';

export type ManifestAuthor = PublishedManifest['authors'][number];

type AuthorFace = {
	name: string;
	avatarUrl: string;
};

export type ResolvedAuthor =
	| (AuthorFace & {
			kind: 'user';
			discordId: DiscordId;
			/** `null` until their Discord profile is cached. */
			username: string | null;
			userId: string;
			role: string;
			badge: PublicBadge | null;
			memberSince: string;
	  })
	| (AuthorFace & { kind: 'discord'; discordId: DiscordId; username: string })
	| (AuthorFace & { kind: 'manifest'; discordId: DiscordId | null });

export type IdentifiedAuthor = ResolvedAuthor & { discordId: DiscordId };

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
	if (!isDiscordId(author.id)) {
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
			username: found?.username ?? null,
			userId: linked.id,
			// The account copied its name and avatar from Discord once, at sign-up; the cached profile is newer.
			name: found ? (found.globalName ?? found.username) : linked.name,
			avatarUrl: found ? discordAvatarUrl : (linked.image ?? discordAvatarUrl),
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
			name: found.globalName ?? found.username,
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
		.orderBy(asc(account.createdAt), asc(account.id));

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
	return isDiscordId(author.id) ? author.id : `0:${author.name}`;
}

/**
 * @description Loads what resolving these manifests' authors needs, requesting a profile refresh
 * when any is missing or stale.
 * @param ctx The application context.
 * @param lists The authors of each manifest that will be resolved.
 * @returns A pure resolver: linked Unbound user, else cached Discord profile, else the manifest name.
 */
export async function loadAuthors(
	ctx: AppContext,
	lists: ManifestAuthor[][],
): Promise<AuthorResolver> {
	const ids = [
		...new Set(lists.flat().flatMap((author) => (isDiscordId(author.id) ? [author.id] : []))),
	];
	const [linked, cached] = await Promise.all([readLinkedUsers(ctx, ids), readProfiles(ctx, ids)]);

	if (ids.some((id) => isStale(ctx, cached.get(id)))) {
		requestProfileRefresh();
	}

	return (authors) => {
		const unique = new Map<string, ManifestAuthor>();

		for (const author of authors) {
			if (!unique.has(authorKey(author))) {
				unique.set(authorKey(author), author);
			}
		}

		return [...unique.values()].map((author) =>
			pickAuthor(author, linked.get(author.id), cached.get(author.id)),
		);
	};
}

export default { isIdentified, loadAuthors };
