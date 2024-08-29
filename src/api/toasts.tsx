import type { ToastOptions } from '@typings/api/toasts';
import { createLogger } from '@structures/logger';
import { find, findByProps } from '@api/metro';
import { ToastContainer } from '@ui/toasts';
import { addToast } from '@stores/toasts';
import { createPatcher } from '@patcher';
import { getStore } from '@api/storage';
import { uuid } from '@utilities';

export type * from '@typings/api/toasts';

const Patcher = createPatcher('toasts');
const Logger = createLogger('Toasts');
const Settings = getStore('unbound');

export function showToast(options: ToastOptions) {
	options.id ??= uuid();

	return addToast(options);
}

try {
	const { ToastContainer: Container } = findByProps('ToastContainer', { lazy: true });
	const Toasts = find(x => x.open && x.close && Object.keys(x).length === 2, { lazy: true });

	// Render our toasts
	Patcher.instead(Container, 'type', (_, __, res) => {
		const settings = Settings.useSettingsStore(({ key }) => key.startsWith('toasts'));

		if (!settings.get('toasts.enabled', true)) {
			return res;
		}

		return <ToastContainer />;
	});

	// Convert Discord's toasts into our toasts
	Patcher.instead(Toasts, 'open', (self, args: [ToastOptions], orig) => {
		if (Settings.get('toasts.enabled', true)) {
			const [options] = args;

			options.title = options.content;
			options.tintedIcon = false;
			delete options.content;

			// Set default duration for discord toasts such as badges.
			options.duration ??= 5000;

			return showToast(options);
		}

		return orig.apply(self, args);
	});
} catch (e) {
	Logger.error('Failed to patch ToastContainer:', e.message);
}

export default { showToast };