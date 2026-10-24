import { toasts } from '@unbound-app/api';

/**
 * @description Shows a toast titled with the plugin's name.
 * @param content The toast's text.
 */
export function notify(content: string): void {
	toasts.showToast({ title: 'Custom Commands', content });
}

// UNKNOWN: a caught error can be any thrown value.
/**
 * @description Shows a caught error's message in a toast.
 * @param error The caught error.
 * @param fallback The text to show when the error has no message.
 */
export function notifyError(error: unknown, fallback: string): void {
	notify(error instanceof Error ? error.message : fallback);
}

export default { notify, notifyError };
