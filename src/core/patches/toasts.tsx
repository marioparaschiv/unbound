import { showToast, type ToastOptions } from '@api/toasts';
import { createLogger } from '@structures/logger';
import { find, findByProps } from '@api/metro';
import { createPatcher } from '@api/patcher';
import { ToastContainer } from '@ui/toasts';
import { getStore } from '@api/storage';

const Patcher = createPatcher('unbound-toasts');
const Logger = createLogger('Core', 'Toasts');
const Settings = getStore('unbound');

export function apply() {
	patchToastContainer();
	patchToastAPI();
}

export function remove() {
	Patcher.unpatchAll();
}

function patchToastContainer() {
	const Components = findByProps('ToastContainer');
	if (!Components || !Components.ToastContainer) {
		return Logger.error('Failed to find ToastContainer component.');
	}

	Patcher.after(Components.ToastContainer, 'type', (_, __, res) => {
		const settings = Settings.useSettingsStore(({ key }) => key.startsWith('toasts'));

		if (settings.get('toasts.enabled', true)) {
			return <ToastContainer />;
		}

		return res;
	});
}

function patchToastAPI() {
	const Toasts = find(x => x.open && x.close && Object.keys(x).length === 2, { lazy: true });
	if (!Toasts || !Toasts.open) {
		return Logger.error('Failed to find Toaster API.');
	}

	// Redirect Discord's toasts to ours.
	Patcher.instead(Toasts, 'open', (self, args: [ToastOptions], orig) => {
		if (!Settings.get('toasts.enabled', true)) {
			return orig.apply(self, args);
		}

		const [options] = args;

		options.title = options.content;
		options.tintedIcon = false;
		delete options.content;

		// Set default duration for discord toasts such as badges.
		options.duration ??= 5000;

		return showToast(options);
	});
}