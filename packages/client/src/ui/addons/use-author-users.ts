import type { AddonAuthor } from '@unbound-app/types';
import { useEffect, useState } from 'react';

import { DefaultAvatars } from '~/api/metro/components';
import { AsyncUsers } from '~/api/metro/api';
import { Users } from '~/api/metro/stores';

/** The fields of Discord's user record that the author line reads. */
export type DiscordUser = {
	id: string;
	username: string;
	globalName?: string | null;
	getAvatarURL: (guildId: undefined, size: number) => string;
};

export type AvatarSource = { uri: string } | number;

/** A manifest author with their Discord account, or `null` when the id doesn't resolve to one. */
export type AuthorUser = {
	author: AddonAuthor;
	user: DiscordUser | null;
	avatar: AvatarSource;
};

// One lookup per Discord id for the whole session.
const requests = new Map<string, Promise<DiscordUser | null>>();

function fetchUser(id: string): Promise<DiscordUser | null> {
	const existing = requests.get(id);

	if (existing) {
		return existing;
	}

	const cached: DiscordUser | undefined = Users.getUser(id);
	const request: Promise<DiscordUser | null> = cached
		? Promise.resolve(cached)
		: AsyncUsers.getUser(id).then(
				() => Users.getUser(id) ?? null,
				() => null,
			);

	requests.set(id, request);

	return request;
}

function toAuthorUser(author: AddonAuthor, user: DiscordUser | null, index: number): AuthorUser {
	const defaults: number[] = DefaultAvatars.DEFAULT_AVATARS;

	return {
		author,
		user,
		avatar: user
			? { uri: user.getAvatarURL(void 0, 64) }
			: (defaults[index % defaults.length] ?? 0),
	};
}

/**
 * @description Resolves each author's Discord account and avatar, falling back to Discord's default
 * avatars until the lookup settles or when it fails.
 * @param authors The manifest authors to resolve.
 * @returns One entry per author, in manifest order.
 */
function useAuthorUsers(authors: AddonAuthor[]): AuthorUser[] {
	const [users, setUsers] = useState<(DiscordUser | null)[]>([]);

	useEffect(() => {
		let live = true;

		Promise.all(authors.map((author) => fetchUser(author.id))).then((resolved) => {
			if (live) {
				setUsers(resolved);
			}
		});

		return () => {
			live = false;
		};
	}, [authors]);

	return authors.map((author, index) => toAuthorUser(author, users[index] ?? null, index));
}

export default useAuthorUsers;
