import type { ToastOptions } from '@typings/api/toasts';
import { addToast } from '@stores/toasts';
import { uuid } from '@utilities';

export type * from '@typings/api/toasts';

export function showToast(options: ToastOptions) {
	options.id ??= uuid();

	return addToast(options);
}

export default { showToast };