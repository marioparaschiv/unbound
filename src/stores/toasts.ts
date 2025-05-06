import type { InternalToastOptions, ToastOptions } from '@typings/api/toasts';
import type { ToastStoreState } from '@typings/stores/toasts';
import { uuid } from '@utilities';
import { create } from 'zustand';


const ToastStore = create<ToastStoreState>((set, get) => ({
	toasts: {},

	addToast(options: InternalToastOptions) {
		options.id ??= uuid();
		options.date ??= Date.now();

		set(prev => ({
			toasts: {
				...prev.toasts,
				[options.id]: options
			}
		}));

		return {
			update(newOptions: Nullable<ToastOptions>) {
				get().updateToastWithOptions(options.id, newOptions);
			},

			close() {
				get().updateToastWithOptions(options.id, { closing: true });
			}
		};
	},

	updateToastWithOptions(id: Required<InternalToastOptions['id']>, options: Partial<InternalToastOptions>) {
		set((prev) => {
			const existing = prev.toasts[id];
			if (!existing) return prev;

			const toasts = {
				...prev.toasts,
				[id]: {
					...existing,
					...options
				}
			};

			return { toasts };
		});
	}
}));

export default ToastStore;