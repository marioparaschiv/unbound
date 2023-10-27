import { ToastOptions } from '@typings/api/toasts';
import { useSettingsStore, get } from '@api/storage';
import { addToast } from '@stores/toasts';
import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import { find, findByProps } from '@metro';

import { ToastContainer } from '@ui/toasts';

const Patcher = createPatcher('toasts');
const Logger = createLogger('Toasts');

export function showToast(options: ToastOptions) {
	return addToast(options);
}

try {
	const { ToastContainer: Container } = findByProps('ToastContainer', { lazy: true });
	const Toasts = find(x => x.open && x.close && Object.keys(x).length === 2, { lazy: true });

	// Render our toasts
	Patcher.after(Container, 'type', (_, __, res) => {
		const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));

		if (!settings.get('toasts.enabled', true)) {
			return res;
		}

		return <ToastContainer />
	});

	// Convert Discord's toasts into our toasts
	Patcher.instead(Toasts, 'open', (_, [options]) => {
		if (get('unbound', 'toasts.enabled', true)) {
			options.title = options.content;
			delete options.content;

			showToast(options);
		}
	});
} catch (e) {
	Logger.error('Failed to patch ToastContainer:', e.message);
}

export default { showToast };