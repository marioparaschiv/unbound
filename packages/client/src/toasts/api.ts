import type { ToastHandle, ToastOptions } from '@unbound-app/types/toasts';
import { createLogger } from '@unbound-app/logger';
import uuid from '@unbound-app/utils/uuid';

import { createFeedbackToasts, type ToastShorthandOptions } from '~/toasts/feedback';
import type { MessageArgs, MessageKey } from '~/i18n/message';
import { hasVisibleContent } from '~/toasts/content';
import { coreMessages } from '~/i18n/core-lookup';
import { getSetting } from '~/settings/unbound';
import useToastStore from '~/toasts/state';

const Logger = createLogger('Toasts');
const feedback = createFeedbackToasts({
	messages: coreMessages,
	core: coreMessages,
	logger: Logger,
	show,
});

const noopHandle: ToastHandle = {
	update() {},
	close() {},
};

/**
 * @description Shows a toast, generating an id when one is not supplied.
 * @param options The toast options, optionally including a custom `id`.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function show(options: ToastOptions): ToastHandle {
	if (!hasVisibleContent(options)) {
		Logger.warn('Ignored a toast with nothing to show', new Error().stack);

		return noopHandle;
	}

	const store = useToastStore.getState();
	const id = options.id ?? uuid();

	if (import.meta.env.DEV_TOOLS && getSetting('developer-mode')) {
		Logger.info('Showing a toast:', typeof options.title === 'string' ? options.title : id);
	}

	return store.addToast({ ...options, id });
}

/**
 * @description Shows a success toast titled by a message key, with a check icon.
 * @param key The message key.
 * @param args The key's placeholder values when it has placeholders, then optional `icon`, `duration` and `id`.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function success<K extends MessageKey>(
	key: K,
	...args: MessageArgs<K, [options?: ToastShorthandOptions]>
): ToastHandle {
	return feedback.success(key, ...args);
}

/**
 * @description Shows an info toast titled by a message key, with an info icon.
 * @param key The message key.
 * @param args The key's placeholder values when it has placeholders, then optional `icon`, `duration` and `id`.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function info<K extends MessageKey>(
	key: K,
	...args: MessageArgs<K, [options?: ToastShorthandOptions]>
): ToastHandle {
	return feedback.info(key, ...args);
}

/**
 * @description Shows a warning toast titled by a message key, with a warning icon.
 * @param key The message key.
 * @param args The key's placeholder values when it has placeholders, then optional `icon`, `duration` and `id`.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function warning<K extends MessageKey>(
	key: K,
	...args: MessageArgs<K, [options?: ToastShorthandOptions]>
): ToastHandle {
	return feedback.warning(key, ...args);
}

/**
 * @description Shows an error toast with an X icon, titled "Something went wrong" in the user's language, with the
 * error's own message as its text, and logs the error.
 * @param cause What was thrown or rejected: an Error, a string or anything else.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function error(cause: unknown): ToastHandle;
/**
 * @description Shows an error toast titled by a message key, with the error's message as its text, and logs the error.
 * @param key The title's message key.
 * @param args The key's placeholder values when it has placeholders, then the error, then optional `icon`, `duration` and `id`.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function error<K extends MessageKey>(
	key: K,
	...args: MessageArgs<K, [error: unknown, options?: ToastShorthandOptions]>
): ToastHandle;
export function error(...args: unknown[]): ToastHandle {
	return Reflect.apply(feedback.error, undefined, args);
}

export default { show, success, info, warning, error };
