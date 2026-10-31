import type applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { FluxStore } from '@unbound-app/api/flux';

import type { Reaction } from '~/reaction-context';

export type Feature = Parameters<typeof applyFeatures>[1][number];

export type ReactionChange = {
	channelId?: string;
	channel_id?: string;
	messageId?: string;
	message_id?: string;
};

export type ReactedMessage = {
	reactions?: Reaction[];
};

type MessageStore = FluxStore & {
	getMessage(channelId: string, messageId: string): ReactedMessage | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Message: MessageStore;
	}

	interface FluxActions {
		MESSAGE_REACTION_ADD: ReactionChange;
		MESSAGE_REACTION_REMOVE: ReactionChange;
		MESSAGE_REACTION_REMOVE_ALL: ReactionChange;
		MESSAGE_REACTION_REMOVE_EMOJI: ReactionChange;
	}
}
