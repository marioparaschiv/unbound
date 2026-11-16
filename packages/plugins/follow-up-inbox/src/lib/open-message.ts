import { metro } from '@unbound-app/api';

import type { FollowUp } from '~/lib/follow-ups';

type Router = {
	transitionToGuild?: (guildId: string, channelId: string, messageId: string) => void;
};

/**
 * @description Opens a follow-up's message in its channel and highlights it.
 * @param entry The follow-up.
 */
export function openMessage({ guildId, channelId, messageId }: FollowUp): void {
	const router = metro.findByProps('transitionToGuild') as Router | undefined;

	router?.transitionToGuild?.(guildId ?? '@me', channelId, messageId);
}

export default { openMessage };
