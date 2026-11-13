import { flux, metro, patcher } from '@unbound-app/api';

import { favouritesFirst } from '~/lib/favourites-first';

import type { Emoji } from '~/lib/types';

const DISCORD_MAX_COUNT = 10;

type EmojiResults = {
	emojis: { unlocked: Emoji[]; locked: Emoji[] };
};

type EmojiQuery = { maxCount?: number };

/**
 * @description Puts favourite emoji first in the `:` autocomplete above the message box.
 * Patches `queryEmojiResults` in Discord's autocomplete utilities to search every match, sort, then cut to Discord's count.
 */
export function patchEmojiAutocomplete(): void {
	const Autocomplete = metro.findByProps('queryEmojiResults', 'queryMentionResults');
	const EmojiStore = flux.getStore('Emoji');

	if (typeof Autocomplete?.queryEmojiResults !== 'function' || !EmojiStore) {
		logger.warn(
			'Favourite emoji first skipped: Discord moved queryEmojiResults or EmojiStore.',
		);

		return;
	}

	patcher.instead(Autocomplete, 'queryEmojiResults', ({ args: [query], original }) => {
		const { maxCount = DISCORD_MAX_COUNT } = (query ?? {}) as EmojiQuery;
		const results: EmojiResults = original({ ...query, maxCount: Number.POSITIVE_INFINITY });
		const context = EmojiStore.getDisambiguatedEmojiContext();
		const isFavourite = (emoji: Emoji) =>
			Boolean(context.isFavoriteEmojiWithoutFetchingLatest(emoji));

		results.emojis.unlocked = favouritesFirst(results.emojis.unlocked, isFavourite, maxCount);
		results.emojis.locked = favouritesFirst(results.emojis.locked, isFavourite, maxCount);

		return results;
	});
}
