type Store = import('@unbound-app/api/flux').FluxStore;

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Permission: Store & { can(permission: bigint | number, channel: unknown): boolean };
		Sticker: Store & { getStickerById(id: string): unknown };
	}
}

export {};
