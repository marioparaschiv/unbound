type Store = import('@unbound-app/api/flux').FluxStore;

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		ExpandedGuildFolder: Store & {
			getExpandedFolders(): Iterable<number | string>;
			isFolderExpanded(id: number | string): boolean;
		};
	}
}

export {};
