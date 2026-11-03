import type { APIApplicationEmoji, APIUser, REST } from 'discord.js';
import { createLogger } from '@unbound-app/logger';

import { renderRoundAvatar } from '~/lib/card-images';
import { isNotFound } from '~/lib/discord-messages';
import type { AppEmoji } from '~/lib/constants';

/** Keeps one round avatar emoji per addon author on the bot application, following avatar changes. */
export type AuthorEmojis = {
	/** The current avatar emoji of each Discord user id that has one; a failed sync leaves the id out. */
	resolve: (discordIds: readonly string[]) => Promise<Map<string, AppEmoji>>;
	/** Deletes the avatar emojis of every user not kept. */
	prune: (keep: ReadonlySet<string>) => Promise<void>;
};

/** The emoji name a user's avatar maps to, and when the avatar was last looked up. */
type CheckedUser = { name: string; at: number };

const logger = createLogger('Bot', 'AuthorEmojis');

// `av_<user id>_<avatar hash prefix>`: a new avatar gets a new name, so a stale emoji is never reused.
const PREFIX = 'av_';
const NAME = /^av_(\d+)_[\da-z]+$/;
const SNOWFLAKE = /^\d{17,20}$/;
const DEFAULT_AVATARS = 6n;
// Avatars are looked up again after this long, so a changed avatar shows on the next reconcile.
const USER_TTL_MS = 5 * 60_000;

function emojiName(user: Pick<APIUser, 'id' | 'avatar'>): string {
	return `${PREFIX}${user.id}_${user.avatar?.replace(/^a_/, '').slice(0, 8) ?? 'default'}`;
}

function avatarUrl(user: Pick<APIUser, 'id' | 'avatar'>): string {
	if (!user.avatar) {
		return `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % DEFAULT_AVATARS}.png`;
	}

	return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function ownerOf(name: string): string | undefined {
	return NAME.exec(name)?.[1];
}

/**
 * @description Creates the avatar emoji sync of one bot application.
 * @param rest The Discord REST client.
 * @param applicationId The bot application, which owns the emojis.
 * @returns The sync; it lists the application's emojis once, then tracks its own changes.
 */
export function createAuthorEmojis(rest: REST, applicationId: string): AuthorEmojis {
	const route = `/applications/${applicationId}/emojis` as const;
	const checked = new Map<string, CheckedUser>();
	const pending = new Map<string, Promise<AppEmoji | undefined>>();
	let listing: Promise<Map<string, AppEmoji>> | undefined;

	async function list() {
		const { items } = (await rest.get(route)) as { items: APIApplicationEmoji[] };

		return new Map(
			items.flatMap((emoji) =>
				emoji.id && emoji.name ? [[emoji.name, { name: emoji.name, id: emoji.id }]] : [],
			),
		);
	}

	function emojis() {
		listing ??= list().catch((error: Error) => {
			listing = undefined;
			throw error;
		});

		return listing;
	}

	async function remove(owned: Map<string, AppEmoji>, emoji: AppEmoji) {
		try {
			await rest.delete(`${route}/${emoji.id}`);
			owned.delete(emoji.name);
		} catch (error) {
			logger.warn(`Failed to delete avatar emoji ${emoji.name}:`, error);
		}
	}

	async function upload(
		owned: Map<string, AppEmoji>,
		user: Pick<APIUser, 'id' | 'avatar'>,
		name: string,
	) {
		const png = await renderRoundAvatar(avatarUrl(user));
		const created = (await rest.post(route, {
			body: { name, image: `data:image/png;base64,${png.toString('base64')}` },
		})) as APIApplicationEmoji;
		const emoji = { name, id: created.id ?? '' };

		owned.set(name, emoji);

		// The old avatar's emoji goes once the new one exists, so a card never points at a gap.
		for (const stale of owned.values()) {
			if (stale.name !== name && ownerOf(stale.name) === user.id) {
				await remove(owned, stale);
			}
		}

		return emoji;
	}

	async function sync(discordId: string): Promise<AppEmoji | undefined> {
		const owned = await emojis();
		const known = checked.get(discordId);

		if (known && Date.now() - known.at < USER_TTL_MS) {
			return owned.get(known.name);
		}

		let user: APIUser;

		try {
			user = (await rest.get(`/users/${discordId}`)) as APIUser;
		} catch (error) {
			if (!isNotFound(error)) {
				throw error;
			}

			// A manifest can name an id that is no Discord user; it has no avatar to show.
			checked.set(discordId, { name: '', at: Date.now() });

			return;
		}

		const name = emojiName(user);
		const emoji = owned.get(name) ?? (await upload(owned, user, name));

		checked.set(discordId, { name, at: Date.now() });

		return emoji;
	}

	function syncOnce(discordId: string) {
		let running = pending.get(discordId);

		if (!running) {
			running = sync(discordId)
				.catch((error: Error) => {
					logger.warn(`Failed to sync the avatar emoji of user ${discordId}:`, error);

					return undefined;
				})
				.finally(() => pending.delete(discordId));
			pending.set(discordId, running);
		}

		return running;
	}

	return {
		async resolve(discordIds) {
			const ids = [...new Set(discordIds)].filter((id) => SNOWFLAKE.test(id));
			const emojis = await Promise.all(ids.map(syncOnce));

			return new Map(
				ids.flatMap((id, index) => {
					const emoji = emojis[index];

					return emoji ? [[id, emoji]] : [];
				}),
			);
		},
		async prune(keep) {
			let owned: Map<string, AppEmoji>;

			try {
				owned = await emojis();
			} catch (error) {
				logger.warn('Failed to list the application emojis:', error);

				return;
			}

			for (const emoji of owned.values()) {
				const owner = ownerOf(emoji.name);

				if (owner && !keep.has(owner)) {
					await remove(owned, emoji);
					checked.delete(owner);
				}
			}
		},
	};
}

export default { createAuthorEmojis };
