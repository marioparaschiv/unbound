import type { InternalToastOptions, ToastOptions } from '@typings/api/toasts';
import createStore from '@structures/store';
import { uuid } from '@utilities';


const store = createStore<{
	toasts: {
		[key: PropertyKey]: InternalToastOptions;
	};
}>({ toasts: {} });

function updateToastWithOptions(id: any, options: Nullable<InternalToastOptions>) {
	store.setState(prev => {
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

export function addToast(options: InternalToastOptions) {
	options.id ??= uuid();
	options.date ??= Date.now();

	store.setState(prev => ({
		toasts: {
			...prev.toasts,
			[options.id]: options
		}
	}));

	return {
		update(newOptions: Nullable<ToastOptions>) {
			updateToastWithOptions(options.id, newOptions);
		},

		close() {
			updateToastWithOptions(options.id, { closing: true });
		}
	};
}

export default store;