import type applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { FluxStore } from '@unbound-app/api/flux';

import type { Reaction } from '~/reaction-context';

export type Feature = Parameters<typeof applyFeatures>[1][number];

/** What every `MESSAGE_REACTION_*` action carries about its message, in either casing. */
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
	// oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
	interface FluxStores {
		Message: MessageStore;
	}

	// oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
	interface FluxActions {
		MESSAGE_REACTION_ADD: ReactionChange;
		MESSAGE_REACTION_REMOVE: ReactionChange;
		MESSAGE_REACTION_REMOVE_ALL: ReactionChange;
		MESSAGE_REACTION_REMOVE_EMOJI: ReactionChange;
	}
}
