import type { InternalToastOptions } from '@api/toasts';


export interface ToastStoreState {
	toasts: Record<PropertyKey, InternalToastOptions>;
	addToast(options: InternalToastOptions);
	updateToastWithOptions(id: Required<InternalToastOptions['id']>, options: Partial<InternalToastOptions>);
}