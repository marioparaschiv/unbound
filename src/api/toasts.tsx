import type { ToastOptions } from '@typings/api/toasts';
import { get, useSettingsStore } from '@api/storage';
import { createLogger } from '@structures/logger';
import { find, fastFindByProps } from '@metro';
import { ToastContainer } from '@ui/toasts';
import { addToast } from '@stores/toasts';
import { createPatcher } from '@patcher';

const Patcher = createPatcher('toasts');
const Logger = createLogger('Toasts');

export function showToast(options: ToastOptions) {
	return addToast(options);
}

try {
	const { ToastContainer: Container } = fastFindByProps('ToastContainer', { lazy: true });
	const Toasts = find(x => x.open && x.close && Object.keys(x).length === 2, { lazy: true });

	// Render our toasts
	Patcher.after(Container, 'type', (_, args, res) => {
		const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));

		if (!settings.get('toasts.enabled', true)) {
			return res;
		}

		return <ToastContainer />;
	});

	// Convert Discord's toasts into our toasts
	Patcher.instead(Toasts, 'open', (self, args: [ToastOptions], orig) => {
		if (get('unbound', 'toasts.enabled', true)) {
			const [options] = args;

			options.title = options.content;
			options.tintedIcon = false;
			delete options.content;

			return showToast(options);
		}

		return orig.apply(self, args);
	});
} catch (e) {
	Logger.error('Failed to patch ToastContainer:', e.message);
}

export default { showToast };