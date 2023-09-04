import { InternalToastOptions, ToastOptions } from '@typings/api/toasts';
import createStore from '@structures/store';
import { uuid } from '@utilities';

const [store, useStore] = createStore({ toasts: {} });

function updateToastWithOptions(id: any, options: Nullable<InternalToastOptions>) {
	store.setState(prev => ({
		toasts: {
			...prev.toasts,
			...prev.toasts[id] ? {
				[id]: {
					...prev.toasts[id],
					...options
				}
			} : {}
		}
	}));
}

export function addToast(options: InternalToastOptions) {
	if (!options.id) options.id = uuid();
	if (!options.date) options.date = Date.now();

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

export { store as toasts, useStore as useToasts };
export default { store, useStore };