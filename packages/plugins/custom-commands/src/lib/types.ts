import type { FluxChannel, FluxMessage, FluxStore } from '@unbound-app/api/flux';

/** The reply the user is writing, as Discord's `PendingReplyStore` holds it. */
export type PendingReply = {
	channel: FluxChannel;
	message: FluxMessage;
	shouldMention: boolean;
	showMentionToggle: boolean;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		PendingReply: FluxStore & {
			getPendingReply?(channelId: string): PendingReply | undefined;
		};
	}

	interface FluxActions {
		DELETE_PENDING_REPLY: { channelId: string };
	}
}
