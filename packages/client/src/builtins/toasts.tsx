import { createLogger } from '@unbound-app/logger';

import { find, findByFilePath, findByProps } from '~/api/metro';
import { createPatcher } from '~/api/patcher';
import { ToastContainer } from '~/ui/toasts';
import { showToast } from '~/api/toasts';
import storage from '~/api/storage';

import discordToastOptions, { type DiscordToastOptions } from './discord-toast-options';
import findToastContainers from './find-toast-containers';

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

function patchToastContainer() {
	const targets = findToastContainers(findByFilePath, findByProps);

	if (!targets.length) {
		Logger.error('Failed to find ToastContainer component');

		return;
	}

	for (const [module, key] of targets) {
		Patcher.after(module, key, ({ result }) => {
			const settings = Settings.useSettingsStore(({ key }) => key?.startsWith('toasts'));

			if (settings.get('toasts.enabled', true)) {
				return <ToastContainer />;
			}

			return result;
		});
	}
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

		const [options] = args as [DiscordToastOptions | undefined];
		const mapped = discordToastOptions(options ?? {});

		if (!mapped) {
			Logger.warn(
				'Ignored a Discord toast with nothing to show',
				new Error().stack,
				Object.keys(options ?? {}),
			);

			return;
		}

		return showToast(mapped);
	});
}

export default { start, stop };
