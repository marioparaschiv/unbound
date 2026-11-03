import { storage } from '@unbound-app/api';

import { MessageStore } from '~/modules';

const REDRAW_KEYS: readonly (string | null)[] = ['replaceElements', 'dearrowByDefault', null];

/**
 * @description Redraws the chat rows, so they pick up new branding or a switched embed.
 */
export function redrawMessages() {
	MessageStore.emitChange?.();
}

/**
 * @description Redraws the chat when a setting that changes how embeds look changes.
 * @returns A function that stops listening.
 */
export function subscribeSettings(): () => void {
	return storage.onChange(
		(payload) => payload.store === addon.id && REDRAW_KEYS.includes(payload.key),
		redrawMessages,
	);
}
