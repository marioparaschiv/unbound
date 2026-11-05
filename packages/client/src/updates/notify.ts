import type { ToastHandle, ToastOptions } from '@unbound-app/types/toasts';
import { createLogger } from '@unbound-app/logger';

import { describeRequiredLoader } from '~/updates/describe-required-loader';
import { readInstallKind } from '~/updates/install-kind';
import navigationReady from '~/core/navigation-ready';
import type { UpdatesState } from '~/updates/state';
import { messages, format } from '~/i18n/api';
import { Screens } from '~/core/constants';
import { show } from '~/toasts/api';

const logger = createLogger('Updater', 'Notify');

const TOAST_ID = 'unbound-updates';

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
 * @param announceAvailable Whether to announce waiting updates; a too-old loader is always announced, as
 * Unbound otherwise stops updating without a word.
 */
export function notifyUpdates(state: UpdatesState, announceAvailable: boolean) {
	if (state.status !== 'ready') return;

	if (state.requiredLoader) {
		showWithView({
			title: messages.UNBOUND_UPDATES_LOADER_REQUIRED,
			content: describeRequiredLoader(state.requiredLoader, readInstallKind()),
			icon: 'WarningIcon',
		});

		return;
	}

	const count = state.updates.length + (state.loader ? 1 : 0);

	if (!announceAvailable || count === 0) return;

	showWithView({
		title: format('UNBOUND_UPDATES_NOTIFY_TITLE', { count }),
		icon: 'DownloadIcon',
	});
}

export default { notifyUpdates };
