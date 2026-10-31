import type applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { FluxStore } from '@unbound-app/api/flux';

export type CardProgress = {
	drawn: number;
	settling: boolean;
};

/** The running code cards on one platform, as the self-test reads them. */
export type Cards = {
	feature: Parameters<typeof applyFeatures>[1][number];
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
