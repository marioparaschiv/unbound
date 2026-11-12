import { flux } from '@unbound-app/api';

import type { PingMessage } from '~/lib/ping-rules';
import { recentMessages } from '~/lib/sound-target';

/**
 * @description Records each received message before Discord handles it, so the sound patch can tell which message a sound is for.
 */
export function interceptMessageCreate(): void {
	flux.interceptAction('MESSAGE_CREATE', ({ message, optimistic }) => {
		if (optimistic || !message?.id) return;

		recentMessages.record(message as unknown as PingMessage, Date.now());
	});
}
