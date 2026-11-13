type Store = import('@unbound-app/api/flux').FluxStore;

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		CollectiblesCategory: Store & { products?: Map<string, unknown> };
	}
}

export {};
