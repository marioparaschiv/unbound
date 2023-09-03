import { InternalToastOptions } from '@typings/api/toasts';
import createStore from '@structures/store';
import { uuid } from '@utilities';

const [store, useStore] = createStore({ toasts: {} });

export function addToast(options: InternalToastOptions) {
	if (!options.id) options.id = uuid();
	if (!options.date) options.date = Date.now();

	store.setState(prev => ({
		toasts: {
			...prev.toasts,
			[options.id]: options
		}
	}));

	return options.id;
}

export { store as toasts, useStore as useToasts };
export default { store, useStore };