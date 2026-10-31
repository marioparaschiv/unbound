import { createLogger } from '@unbound-app/logger';

import { getSetting, useUnboundSettings } from '~/settings/unbound';
import type { MetroFilter } from '~/metro/filters';
import { onModuleLoaded } from '~/metro/wait';
import ToastContainer from '~/ui/toasts/toast-container';
import type { SectionEntry } from '~/settings/section';
import { createPatcher } from '~/patcher/api';
import ToastsPage from '~/ui/settings/toasts';
import { CACHE_KEY, Screens } from '~/core/constants';
import { show } from '~/toasts/api';

import discordToastOptions, { type DiscordToastOptions } from './discord-toast-options';
import waitForToastContainers from './wait-for-toast-containers';

const Patcher = createPatcher('unbound::toasts');
const Logger = createLogger('Toasts');

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
				const settings = useUnboundSettings(({ key }) => key?.startsWith('toasts'));

				if (settings.get('toasts.enabled')) {
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
		if (!getSetting('toasts.enabled')) {
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

		return show(mapped);
	});
}

export const toastsSection: SectionEntry = {
	key: Screens.Toasts,
	titleKey: 'UNBOUND_TOAST_SETTINGS',
	component: ToastsPage,
	hidden: true,
};

export default { start, stop, toastsSection };
