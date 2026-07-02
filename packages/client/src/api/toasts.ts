import type { ToastHandle, ToastOptions } from '@unbound-app/types/toasts';
import uuid from '@unbound-app/utils/uuid';

import useToastStore from '~/stores/toasts';

/**
 * @description Shows a toast, generating an id when one is not supplied.
 * @param options The toast options, optionally including a custom `id`.
 * @returns A {@link ToastHandle} for controlling the shown toast.
 */
export function showToast(options: ToastOptions): ToastHandle {
	const store = useToastStore.getState();
	const id = options.id ?? uuid();

	return store.addToast({ ...options, id });
}

export default { showToast };
