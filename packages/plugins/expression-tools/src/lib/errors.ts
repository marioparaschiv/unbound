import { messages } from '@unbound-app/i18n';

type ErrorLike = {
	body?: { message?: unknown };
	message?: unknown;
	text?: unknown;
};

/**
 * @description Picks a readable message from an error thrown by Discord's HTTP client, the clipboard, or `fetch`.
 * @param error The rejection value.
 * @returns The API's error message, the error's own message, or a generic sentence.
 */
// UNKNOWN: rejections from Discord's modules carry no declared type.
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;

	if (!error || typeof error !== 'object') return messages.OPERATION_FAILED;

	const { body, message, text }: ErrorLike = error;

	for (const candidate of [body?.message, message, text]) {
		if (typeof candidate === 'string') return candidate;
	}

	return messages.OPERATION_FAILED;
}

export default getErrorMessage;
