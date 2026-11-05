import { toasts } from '@unbound-app/api';

import { getErrorMessage } from '~/expression-actions/errors';
import { messages } from '@unbound-app/i18n';

/**
 * @description Shows a toast titled with the plugin's name.
 * @param content The toast's text.
 */
export function notify(content: string): void {
	toasts.show({ title: messages.EXPRESSION_TOOLS, content });
}

/**
 * @description Shows a failed action's error as a toast.
 * @param error The rejection value.
 */
// UNKNOWN: rejections from Discord's modules carry no declared type.
export function notifyError(error: unknown): void {
	notify(getErrorMessage(error));
}

export default { notify, notifyError };
