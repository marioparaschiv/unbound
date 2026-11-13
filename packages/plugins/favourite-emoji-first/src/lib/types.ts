export type Emoji = { id?: string; name: string };

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Emoji: import('@unbound-app/api/flux').FluxStore & {
			getDisambiguatedEmojiContext(): {
				isFavoriteEmojiWithoutFetchingLatest(emoji: Emoji): boolean;
			};
		};
	}
}
