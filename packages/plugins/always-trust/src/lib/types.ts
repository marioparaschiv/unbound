declare module '@unbound-app/api/flux' {
	interface FluxStores {
		MaskedLink: import('@unbound-app/api/flux').FluxStore & {
			isTrustedDomain(url: string): boolean;
		};
	}
}

export {};
