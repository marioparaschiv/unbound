import { flux } from '@unbound-app/api';

const MAX_NONCES = 500;

const nonces = new Set<string>();

/**
 * @description Whether a message with this nonce was sent from this device since the plugin started.
 * @param nonce The message's nonce.
 * @returns `true` when it was.
 */
export function sentHere(nonce: string): boolean {
	return nonces.has(nonce);
}

/**
 * @description Remembers the nonce of each message this device sends, from Discord's optimistic copy, so its
 * acknowledged version can be marked. Keeps the latest 500.
 */
export function followSentMessages(): void {
	flux.interceptAction('MESSAGE_CREATE', (action) => {
		const { optimistic, message } = action as {
			optimistic?: boolean;
			message?: { nonce?: unknown };
		};

		if (optimistic && typeof message?.nonce === 'string') {
			nonces.add(message.nonce);

			if (nonces.size > MAX_NONCES) nonces.delete(nonces.values().next().value!);
		}

		return false;
	});
}

export default { sentHere, followSentMessages };
