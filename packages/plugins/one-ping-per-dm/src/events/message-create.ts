import { flux } from '@unbound-app/api';

import type { PingMessage } from '~/ping-rules';
import type { RecentMessages } from '~/sound-target';

/**
 * @description Records each received message before Discord handles it, so the sound patch can tell which message a sound is for.
 * @param recent The plugin's recent-message list.
 * @returns A function that stops recording and forgets the messages.
 */
export function recordMessageCreate(recent: RecentMessages): () => void {
	const remove = flux.interceptAction('MESSAGE_CREATE', ({ message, optimistic }) => {
		if (optimistic || !message?.id) return;

		recent.record(message as unknown as PingMessage, Date.now());
	});

	return () => {
		remove();
		recent.clear();
	};
}
