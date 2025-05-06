import type { ToastOptions } from '@typings/api/toasts';
import ToastStore from '@stores/toasts';
import { uuid } from '@utilities';


export type * from '@typings/api/toasts';

export function showToast(options: ToastOptions) {
	const store = ToastStore.getState();

	options.id ??= uuid();

	return store.addToast(options);
}

export default { showToast };