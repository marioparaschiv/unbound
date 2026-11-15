import type { APIApplicationEmoji, REST } from 'discord.js';
import { createLogger } from '@unbound-app/logger';

import { renderRoundAvatar } from '~/lib/card-images';
import type { AppEmoji } from '~/lib/constants';

/** The app emojis a starboard post shows: its author's avatar and copies of emojis from other servers. */
export type StarboardEmojis = {
	/** The author's round avatar emoji, made on first use; undefined when it cannot be made. */
	avatar: (user: AvatarOwner) => Promise<AppEmoji | undefined>;
	/** Swaps every custom emoji the bot cannot show for its own copy; one it cannot copy stays as written. */
	mirror: (content: string, shown: ReadonlySet<string>) => Promise<string>;
	/** Deletes every starboard emoji not named in `keep`. */
	prune: (keep: ReadonlySet<string>) => Promise<void>;
};

/** A message author: the avatar hash names the emoji, so a new avatar gets a new one. */
export type AvatarOwner = { id: string; avatarHash: string | null; avatarUrl: string };

type Image = { data: Buffer; type: 'png' | 'gif' };

const logger = createLogger('Bot', 'StarboardEmojis');

// `sb_<user id>_<avatar hash prefix>` and `se_<emoji id>` fit Discord's 32 character emoji names.
const AVATAR_PREFIX = 'sb_';
const COPY_PREFIX = 'se_';
const OWNED = /^(?:sb|se)_\d+/;
const CUSTOM = /<(a?):(\w{2,32}):(\d{17,20})>/g;

/**
 * @description Lists the starboard emojis a rendered post uses, so they are kept while it exists.
 * @param text Every text of the post.
 * @returns The emoji names.
 */
export function starboardEmojiNames(text: string): string[] {
	return [...text.matchAll(CUSTOM)].flatMap(([, , name]) =>
		name && OWNED.test(name) ? [name] : [],
	);
}

async function download(url: string, type: Image['type']): Promise<Image> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} for ${url}`);
	}

	return { data: Buffer.from(await response.arrayBuffer()), type };
}

/**
 * @description Creates the starboard's emoji store on the bot application.
 * @param rest The Discord REST client.
 * @param applicationId The bot application, which owns the emojis.
 * @returns The store; it lists the application's emojis once, then tracks its own changes.
 */
export function createStarboardEmojis(rest: REST, applicationId: string): StarboardEmojis {
	const route = `/applications/${applicationId}/emojis` as const;
	let listing: Promise<Map<string, AppEmoji>> | undefined;

	async function list() {
		const { items } = (await rest.get(route)) as { items: APIApplicationEmoji[] };

		return new Map(
			items.flatMap((emoji) =>
				emoji.id && emoji.name
					? [
							[
								emoji.name,
								{
									name: emoji.name,
									id: emoji.id,
									animated: Boolean(emoji.animated),
								},
							],
						]
					: [],
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

	async function ensure(name: string, load: () => Promise<Image>): Promise<AppEmoji> {
		const owned = await emojis();
		const known = owned.get(name);

		if (known) {
			return known;
		}

		const { data, type } = await load();
		const created = (await rest.post(route, {
			body: { name, image: `data:image/${type};base64,${data.toString('base64')}` },
		})) as APIApplicationEmoji;
		const emoji = { name, id: created.id ?? '', animated: Boolean(created.animated) };

		owned.set(name, emoji);

		return emoji;
	}

	return {
		async avatar(user) {
			const name = `${AVATAR_PREFIX}${user.id}_${user.avatarHash?.replace(/^a_/, '').slice(0, 8) ?? 'default'}`;

			try {
				return await ensure(name, async () => ({
					data: await renderRoundAvatar(user.avatarUrl),
					type: 'png',
				}));
			} catch (error) {
				logger.warn(`Failed to make the avatar emoji of user ${user.id}:`, error);

				return undefined;
			}
		},
		async mirror(content, shown) {
			let mirrored = content;

			for (const [token, animated, , id] of content.matchAll(CUSTOM)) {
				if (!id || shown.has(id)) {
					continue;
				}

				const type = animated ? 'gif' : 'png';

				try {
					const copy = await ensure(`${COPY_PREFIX}${id}`, () =>
						download(`https://cdn.discordapp.com/emojis/${id}.${type}?size=128`, type),
					);

					mirrored = mirrored.replaceAll(token, `<${animated}:${copy.name}:${copy.id}>`);
				} catch (error) {
					logger.warn(`Failed to copy emoji ${id}:`, error);
				}
			}

			return mirrored;
		},
		async prune(keep) {
			const owned = await emojis();

			// A Map tolerates deleting the entry its iterator is on.
			for (const emoji of owned.values()) {
				if (!OWNED.test(emoji.name) || keep.has(emoji.name)) {
					continue;
				}

				try {
					await rest.delete(`${route}/${emoji.id}`);
					owned.delete(emoji.name);
				} catch (error) {
					logger.warn(`Failed to delete starboard emoji ${emoji.name}:`, error);
				}
			}
		},
	};
}

export default { starboardEmojiNames, createStarboardEmojis };
