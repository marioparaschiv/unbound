import type { ToastOptions } from '@unbound-app/types/api/toasts';
import ToastStore from '~/stores/toasts';
import { uuid } from '~/utilities';


export type * from '@unbound-app/types/api/toasts';

export function showToast(options: ToastOptions) {
	const store = ToastStore.getState();

	options.id ??= uuid();

	return store.addToast(options);
}

export default { showToast };