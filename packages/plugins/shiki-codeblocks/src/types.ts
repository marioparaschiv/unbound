import type { Feature } from '@unbound-plugins/shared/lifecycle/features';
import type { FluxStore } from '@unbound-app/api/flux';

export type CardProgress = {
	drawn: number;
	settling: boolean;
};

export type Cards = {
	feature: Feature;
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
