import type { FluxStore } from '@unbound-app/api/flux';

export type CardProgress = {
	drawn: number;
	settling: boolean;
};

export type Cards = {
	/** Removes the cards and restores Discord's text; a promise for native work that must finish before the plugin's native scope closes. */
	stop: () => void | Promise<void>;
	progress: () => CardProgress;
	misplaced: () => Promise<string[]>;
};

type StoredMessage = {
	content?: unknown;
};

type MessageList = {
	_array?: StoredMessage[];
};

type MessageStore = FluxStore & {
	getMessage(channelId: string, messageId: string): StoredMessage | undefined;
	getMessages(channelId: string | undefined): MessageList | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Message: MessageStore;
	}
}
