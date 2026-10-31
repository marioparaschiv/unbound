import type { FluxMessage, FluxStore } from '@unbound-app/api/flux';

type MessageStore = FluxStore & {
	getMessage(channelId: string, messageId: string): FluxMessage | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Message: MessageStore;
	}
}
