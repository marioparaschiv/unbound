import { metro } from '@unbound-app/api';

import type { TypingLabelValues } from '~/typing-label';

/**
 * @description Formats one of Discord's own messages in the user's locale.
 * @param messageId The message's hashed ID.
 * @param values The message's placeholders.
 * @returns The formatted text, or nothing when Discord lacks the message or cannot format it.
 */
export function formatDiscordMessage(
	messageId: string,
	values: TypingLabelValues,
): string | undefined {
	const { i18n } = metro.common;
	const message = i18n.t?.[messageId];

	if (typeof message !== 'function') return;

	try {
		return i18n.intl.formatToPlainString(message, values);
	} catch {
		return;
	}
}

export default { formatDiscordMessage };
