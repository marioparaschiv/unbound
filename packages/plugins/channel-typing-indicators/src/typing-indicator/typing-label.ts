import { format } from '@unbound-app/i18n';

import { TYPING_MESSAGE_IDS } from '~/constants';

export type TypingLabelValues = Record<'a' | 'b' | 'c', string | undefined>;
export type FormatMessage = (messageId: string, values: TypingLabelValues) => string | undefined;

function pluginLabel(names: string[]): string {
	const [a = '', b = '', c = ''] = names;

	switch (names.length) {
		case 1:
			return format('TYPING_ONE', { a });
		case 2:
			return format('TYPING_TWO', { a, b });
		case 3:
			return format('TYPING_THREE', { a, b, c });
		default:
			return format('TYPING_SEVERAL');
	}
}

/**
 * @description Builds the tooltip text for the typing users, from Discord's own string when it has one and the plugin's otherwise.
 * @param names The display names of the typing users.
 * @param format Formats one of Discord's messages, returning nothing when it is unavailable.
 * @returns The label, or an empty string when nobody is typing.
 */
export function typingLabel(names: string[], format: FormatMessage): string {
	if (!names.length) return '';

	const [a, b, c] = names;
	const messageId = TYPING_MESSAGE_IDS[Math.min(names.length, TYPING_MESSAGE_IDS.length) - 1];

	return format(messageId, { a, b, c }) || pluginLabel(names);
}

export default { typingLabel };
