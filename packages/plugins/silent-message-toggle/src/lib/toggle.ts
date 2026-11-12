import { createChannelToggle } from '@unbound-plugins/shared/composer/channel-toggle';

import { SUPPRESS_NOTIFICATIONS } from '~/lib/constants';

/**
 * @description Adds Discord's SUPPRESS_NOTIFICATIONS bit to a message's flags, the flag Discord sets when a message starts with `@silent `.
 * @param flags The flags already on the send options, if any.
 * @returns The flags with the silent bit set, keeping every other bit.
 */
export function withSilentFlag(flags: unknown): number {
	const current = typeof flags === 'number' && Number.isInteger(flags) ? flags : 0;

	return current | SUPPRESS_NOTIFICATIONS;
}

/** The toggle every button shares. */
export const silentToggle = createChannelToggle();
