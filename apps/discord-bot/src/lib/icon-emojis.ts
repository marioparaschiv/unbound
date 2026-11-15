import type { APIApplicationEmoji, REST } from 'discord.js';
import { renderAddonIcon } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';

import { renderIconEmoji } from '~/lib/card-images';
import type { AppEmoji } from '~/lib/constants';

/** A website icon to upload as an emoji, and the colour to draw it in. */
export type IconEmojiSpec = { icon: string; colour: number };

const logger = createLogger('Bot', 'IconEmojis');
const HASH_LENGTH = 6;

/**
 * @description Uploads website icons as application emojis, once per design: the name carries a hash of the
 * image, so a changed icon or colour uploads anew and its old emoji is deleted.
 * @template K The keys naming each icon.
 * @param rest The Discord REST client.
 * @param applicationId The bot application, which owns the emojis.
 * @param prefix Marks this set's emojis, e.g. `mb_case_`; emojis with it that no spec names are deleted.
 * @param specs The icons, by key.
 * @returns The emoji per key; an icon that fails to render or upload is left out.
 */
export async function syncIconEmojis<K extends string>(
	rest: REST,
	applicationId: string,
	prefix: string,
	specs: Readonly<Record<K, IconEmojiSpec>>,
): Promise<Map<K, AppEmoji>> {
	const route = `/applications/${applicationId}/emojis` as const;
	const { items } = (await rest.get(route)) as { items: APIApplicationEmoji[] };
	const owned = new Map(
		items.flatMap(({ id, name }) => (id && name?.startsWith(prefix) ? [[name, id]] : [])),
	);
	const synced = new Map<K, AppEmoji>();
	// A key whose new design failed keeps its old emoji rather than none.
	const kept: string[] = [];

	for (const key of Object.keys(specs) as K[]) {
		const { icon, colour } = specs[key];
		const svg = renderAddonIcon(icon);

		if (!svg) {
			logger.warn(`Failed to render icon ${icon} for emoji ${key}: no such icon.`);
			continue;
		}

		const png = await renderIconEmoji(svg, colour);
		const hash = new Bun.CryptoHasher('sha256').update(png).digest('hex').slice(0, HASH_LENGTH);
		const name = `${prefix}${key}_${hash}`;
		let id = owned.get(name);

		if (!id) {
			try {
				const created = (await rest.post(route, {
					body: { name, image: `data:image/png;base64,${png.toString('base64')}` },
				})) as APIApplicationEmoji;

				id = created.id ?? undefined;
			} catch (error) {
				logger.warn(`Failed to upload icon emoji ${name}:`, error);
				kept.push(`${prefix}${key}_`);
				continue;
			}
		}

		if (id) {
			synced.set(key, { name, id });
		}
	}

	const current = new Set([...synced.values()].map(({ name }) => name));

	// Stale designs go only after their replacements exist, so a post never points at a gap for long.
	for (const [name, id] of owned) {
		if (current.has(name) || kept.some((start) => name.startsWith(start))) {
			continue;
		}

		try {
			await rest.delete(`${route}/${id}`);
		} catch (error) {
			logger.warn(`Failed to delete stale icon emoji ${name}:`, error);
		}
	}

	return synced;
}

export default { syncIconEmojis };
