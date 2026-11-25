type Store = import('@unbound-app/api/flux').FluxStore;

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Emoji: Store & { getCustomEmojiById(id: string): unknown };
		Permission: Store & { can(permission: bigint | number, channel: unknown): boolean };
		Stickers: Store & { getStickerById(id: string): unknown };
	}
}

export {};
