import type { InternalToastOptions, ToastStoreState } from '@unbound-app/types/toasts';
import { create } from 'zustand';

const ToastStore = create<ToastStoreState>((set, get) => ({
	toasts: {},

	addToast(options: InternalToastOptions) {
		options.date ??= Date.now();

		set((prev) => ({
			toasts: {
				...prev.toasts,
				[options.id]: options,
			},
		}));

		return {
			update(newOptions) {
				get().updateToastWithOptions(options.id, newOptions);
			},
			close() {
				get().updateToastWithOptions(options.id, { closing: true });
			},
		};
	},

	updateToastWithOptions(id: string, options: Partial<InternalToastOptions>) {
		set((prev) => {
			const existing = prev.toasts[id];
			if (!existing) return prev;

			return {
				toasts: {
					...prev.toasts,
					[id]: { ...existing, ...options },
				},
			};
		});
	},
}));

export default ToastStore;
