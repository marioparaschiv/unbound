import type { ToastOptions } from '@unbound-app/types/toasts';
import { createLogger } from '@unbound-app/logger';

import { find, findByFilePath, findByProps } from '~/api/metro';
import { createPatcher } from '~/api/patcher';
import { ToastContainer } from '~/ui/toasts';
import { showToast } from '~/api/toasts';
import storage from '~/api/storage';

const Patcher = createPatcher('unbound::toasts');
const Logger = createLogger('Toasts');
const Settings = storage.getStore('unbound');

/** Replaces Discord's toast container and toast API with Unbound's toasts. */
export function start() {
	patchToastContainer();
	patchToastAPI();
}

/** Restores Discord's toast container and toast API. */
export function stop() {
	Patcher.unpatchAll();
}

type PatchTarget = Record<string, (...args: never[]) => void>;

function toastContainerTarget(): [PatchTarget, string] | undefined {
	const App = findByFilePath('modules/toast/native/AppToastContainer.tsx', { interop: false });

	if (typeof App?.default === 'function') {
		return [App, 'default'];
	}

	const Components = findByProps('ToastContainer');
	const container = Components?.ToastContainer;

	if (typeof container?.type === 'function') {
		return [container, 'type'];
	}

	return typeof container === 'function' ? [Components, 'ToastContainer'] : undefined;
}

function patchToastContainer() {
	const target = toastContainerTarget();

	if (!target) {
		Logger.error('Failed to find ToastContainer component');

		return;
	}

	Patcher.after(target[0], target[1], ({ result }) => {
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
