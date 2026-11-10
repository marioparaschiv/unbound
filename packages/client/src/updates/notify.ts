import type { ToastHandle, ToastOptions } from '@unbound-app/types/toasts';
import { createLogger } from '@unbound-app/logger';

import {
	describeRequiredLoader,
	describeRequiredLoaderTitle,
} from '~/updates/describe-required-loader';
import { readInstallKind } from '~/updates/install-kind';
import navigationReady from '~/core/navigation-ready';
import type { UpdatesState } from '~/updates/state';
import { messages, format } from '~/i18n/api';
import { Screens } from '~/core/constants';
import { reload } from '~/native/runtime';
import { show } from '~/toasts/api';

const logger = createLogger('Updater', 'Notify');

const TOAST_ID = 'unbound-updates';
// Its own id, so the update check's toast a moment later stacks below it instead of replacing it.
const CLIENT_TOAST_ID = 'unbound-client-updated';
const STAGED_TOAST_ID = 'unbound-client-staged';

async function openUpdates(handle: ToastHandle) {
	handle.close();

	try {
		const ref = await navigationReady();

		ref.navigate('settings', { screen: Screens.Updates });
	} catch (error) {
		logger.error('Failed to open the updates screen:', error);
	}
}

type UpdatesToast = Pick<ToastOptions, 'content'> & { title: string; icon: string };

function showWithView(options: UpdatesToast) {
	const handle: ToastHandle = show({
		...options,
		id: TOAST_ID,
		buttons: [
			{ content: messages.UNBOUND_UPDATES_VIEW, onPress: () => void openUpdates(handle) },
		],
	});
}

/**
 * @description Shows a toast for what the last check found: that the loader is too old for the newest bundle,
 * or else how many updates are waiting.
 * @param state The finished check.
 * @param options Whether to announce a waiting loader and waiting addon updates. A too-old loader is always
 * announced, as Unbound otherwise stops updating without a word.
 */
export function notifyUpdates(
	state: UpdatesState,
	{ loader, addons }: { loader: boolean; addons: boolean },
) {
	if (state.status !== 'ready') return;

	if (state.requiredLoader) {
		const kind = readInstallKind();

		showWithView({
			title: describeRequiredLoaderTitle(kind),
			content: describeRequiredLoader(state.requiredLoader, kind),
			icon: 'WarningIcon',
		});

		return;
	}

	const count = (addons ? state.updates.length : 0) + (loader && state.loader ? 1 : 0);

	if (count === 0) return;

	showWithView({
		title: format('UNBOUND_UPDATES_NOTIFY_TITLE', { count }),
		icon: 'DownloadIcon',
	});
}

/**
 * @description Shows a toast when this launch runs a newer client than the last one did.
 * @param previous The client version that last ran; empty on the first launch, which stays quiet.
 * @param current The client version running now.
 */
export function notifyClientUpdated(previous: string, current: string) {
	if (!previous || previous === current) return;

	show({
		id: CLIENT_TOAST_ID,
		title: messages.UNBOUND_UPDATES_CLIENT_UPDATED,
		content: format('UNBOUND_UPDATES_CLIENT_UPDATED_DESC', { version: current }),
		icon: 'CircleCheckIcon',
	});
}

/**
 * @description Offers a restart when a newer client bundle downloaded during this launch.
 */
export function notifyStagedBundle() {
	const handle: ToastHandle = show({
		id: STAGED_TOAST_ID,
		title: messages.UNBOUND_UPDATES_STAGED,
		content: messages.UNBOUND_UPDATES_STAGED_DESC,
		icon: 'DownloadIcon',
		buttons: [
			{
				content: messages.UNBOUND_RESTART,
				onPress: () => {
					handle.close();
					reload().catch((error) =>
						logger.error('Failed to restart for the staged bundle:', error),
					);
				},
			},
		],
	});
}

export default { notifyUpdates, notifyClientUpdated, notifyStagedBundle };
