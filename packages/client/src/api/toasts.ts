import type { ToastHandle, ToastOptions } from '@unbound-app/types/toasts';
import { createLogger } from '@unbound-app/logger';
import uuid from '@unbound-app/utils/uuid';

import { hasVisibleContent } from '~/builtins/discord-toast-options';
import useToastStore from '~/stores/toasts';

const Logger = createLogger('Toasts');

const noopHandle: ToastHandle = {
	update() {},
	close() {},
};

/**
 * @description Shows a toast, generating an id when one is not supplied.
 * @param options The toast options, optionally including a custom `id`.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function showToast(options: ToastOptions): ToastHandle {
	if (!hasVisibleContent(options)) {
		Logger.warn('Ignored a toast with nothing to show', new Error().stack);

		return noopHandle;
	}

	const store = useToastStore.getState();
	const id = options.id ?? uuid();

	return store.addToast({ ...options, id });
}

export default { showToast };
