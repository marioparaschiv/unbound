import { metro } from '@unbound-app/api';

const DELETE_MESSAGE_MESSAGE = 'xwMqD7';
const ENGLISH_LABEL = 'Delete Message';

/**
 * @description Reads Discord's "Delete Message" title in the user's language, which its delete confirmation uses.
 * @returns The title, or the English one when Discord's i18n module or the message is missing.
 */
export function deleteTitle(): string {
	const { i18n } = metro.common;
	const message = i18n?.t?.[DELETE_MESSAGE_MESSAGE];

	if (!message) return ENGLISH_LABEL;

	try {
		return i18n.intl.string(message) || ENGLISH_LABEL;
	} catch (error) {
		logger.error('Failed to read the Delete Message title:', error);

		return ENGLISH_LABEL;
	}
}
