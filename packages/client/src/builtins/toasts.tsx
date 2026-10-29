import type { ToastOptions } from '@unbound-app/types/toasts';

import type { MetroFilter } from '~/api/metro/filters';
import { createPatcher } from '~/api/patcher';
import { onModuleLoaded } from '~/api/metro';
import { ToastContainer } from '~/ui/toasts';
import { CACHE_KEY } from '~/lib/constants';
import { showToast } from '~/api/toasts';
import storage from '~/api/storage';

import waitForToastContainers from './wait-for-toast-containers';

const Patcher = createPatcher('unbound::toasts');
const Settings = storage.getStore('unbound');

const byToastAPI: MetroFilter = (x) => x.open && x.close && Object.keys(x).length === 2;

// A cache key lets the wait watch the API's module alone on later launches.
byToastAPI[CACHE_KEY] = 'unbound::toastAPI';

const waits: Array<() => void> = [];

/** Replaces Discord's toast container and toast API with Unbound's toasts. */
export function start() {
	patchToastContainer();
	patchToastAPI();
}

/** Restores Discord's toast container and toast API. */
export function stop() {
	waits.splice(0).map((stopWaiting) => stopWaiting());
	Patcher.unpatchAll();
}

function patchToastContainer() {
	waits.push(
		waitForToastContainers(onModuleLoaded, ([module, key]) => {
			Patcher.after(module, key, ({ result }) => {
				const settings = Settings.useSettingsStore(({ key }) => key?.startsWith('toasts'));

				if (settings.get('toasts.enabled', true)) {
					return <ToastContainer />;
				}

				return result;
			});
		}),
	);
}

function patchToastAPI() {
	waits.push(onModuleLoaded(byToastAPI, patchOpen));
}

function patchOpen(Toasts: MetroExport) {
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
