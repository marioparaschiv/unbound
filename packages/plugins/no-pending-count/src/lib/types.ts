type Store = import('@unbound-app/api/flux').FluxStore;

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		MessageRequest: Store & { getMessageRequestsCount(): number };
		SpamMessageRequest: Store & { getSpamChannelsCount(): number };
	}
}

export {};
