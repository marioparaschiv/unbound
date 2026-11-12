import { metro } from '@unbound-app/api';

/** Discord's hashed message ID for "Delete Message", the label of the delete row in the message sheet. */
const DELETE_MESSAGE_MESSAGE = 'xwMqD7';
const ENGLISH_LABEL = 'Delete Message';

/**
 * @description Reads Discord's "Delete Message" label in the user's language, which is how its delete row is told apart from the other destructive rows.
 * @returns The label, or the English one when Discord's i18n module or the message is missing.
 */
export function getDeleteLabel(): string {
	const { i18n } = metro.common;
	const message = i18n?.t?.[DELETE_MESSAGE_MESSAGE];

	if (!message) return ENGLISH_LABEL;

	try {
		return i18n.intl.string(message) || ENGLISH_LABEL;
	} catch (error) {
		logger.error('Failed to read the Delete Message label:', error);

		return ENGLISH_LABEL;
	}
}
