import { TYPING_MESSAGE_IDS } from '~/constants';

export type TypingLabelValues = Record<'a' | 'b' | 'c', string | undefined>;
export type FormatMessage = (messageId: string, values: TypingLabelValues) => string | undefined;

function englishLabel(names: string[]): string {
	const [a, b, c] = names;

	switch (names.length) {
		case 1:
			return `${a} is typing...`;
		case 2:
			return `${a} and ${b} are typing...`;
		case 3:
			return `${a}, ${b}, and ${c} are typing...`;
		default:
			return 'Several people are typing...';
	}
}

/**
 * @description Builds the tooltip text for the typing users, in Discord's locale when it has the string.
 * @param names The display names of the typing users.
 * @param format Formats one of Discord's messages, returning nothing when it is unavailable.
 * @returns The label, or an empty string when nobody is typing.
 */
export function typingLabel(names: string[], format: FormatMessage): string {
	if (!names.length) return '';

	const [a, b, c] = names;
	const messageId = TYPING_MESSAGE_IDS[Math.min(names.length, TYPING_MESSAGE_IDS.length) - 1];

	return format(messageId, { a, b, c }) || englishLabel(names);
}

export default { typingLabel };
