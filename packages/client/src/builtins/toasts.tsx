import type { ToastOptions } from '@unbound-app/types/toasts';
import { createLogger } from '@unbound-app/logger';
import { createPatcher } from 'possess';

import { find, findByProps } from '~/api/metro';
import { ToastContainer } from '~/ui/toasts';
import { showToast } from '~/api/toasts';
import storage from '~/api/storage';

const Patcher = createPatcher('unbound::toasts');
const Logger = createLogger('Toasts');
const Settings = storage.getStore('unbound');

export function start() {
	patchToastContainer();
	patchToastAPI();
}

export function stop() {
	Patcher.unpatchAll();
}

function patchToastContainer() {
	const Components = findByProps('ToastContainer');
	if (!Components) {
		Logger.error('Failed to find ToastContainer component');
		return;
	}

	Patcher.after(Components.ToastContainer, 'type', ({ result }) => {
		const settings = Settings.useSettingsStore(({ key }) => key?.startsWith('toasts'));

		if (settings.get('toasts.enabled', true)) {
			return <ToastContainer />;
		}

		return result;
	});
}

function patchToastAPI() {
	const Toasts = find((x) => x.open && x.close && Object.keys(x).length === 2, { lazy: true });
	if (!Toasts?.open) {
		Logger.error('Failed to find Toaster API');
		return;
	}

	Patcher.instead(Toasts, 'open', ({ args, original, this: self }) => {
		if (!Settings.get('toasts.enabled', true)) {
			return original.apply(self, args);
		}

		const [options] = args as [ToastOptions];

		options.title = options.content;
		options.tintedIcon = false;
		delete options.content;

		options.duration ??= 5000;

		return showToast(options);
	});
}

export default { start, stop };
