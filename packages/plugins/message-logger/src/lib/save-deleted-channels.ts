import { settings } from '@unbound-app/settings';
import { fs } from '@unbound-app/api';

import {
	deletedChannels,
	onDeletedChannelsChange,
	parseDeletedChannels,
	restoreDeletedChannels,
	serializeDeletedChannels,
} from '~/lib/deleted-channels';
import { DELETED_CHANNELS_FILE } from '~/lib/constants';

let unsubscribe: (() => void) | undefined;
let stopped = true;

async function save() {
	try {
		if (!settings.persistLog) {
			await fs.removeFile(DELETED_CHANNELS_FILE);

			return;
		}

		await fs.writeFile(DELETED_CHANNELS_FILE, serializeDeletedChannels(deletedChannels()));
	} catch (error) {
		logger.error(`Failed to save the deleted channels to ${DELETED_CHANNELS_FILE}:`, error);
	}
}

async function load() {
	try {
		if (!settings.persistLog || !(await fs.exists(DELETED_CHANNELS_FILE))) return;

		const saved = parseDeletedChannels(await fs.readFile(DELETED_CHANNELS_FILE));

		if (saved && !stopped) restoreDeletedChannels(saved);
	} catch (error) {
		logger.error(`Failed to load the deleted channels from ${DELETED_CHANNELS_FILE}:`, error);
	}
}

/**
 * @description Loads the saved deleted channels, then saves them after each change while `persistLog` is on.
 */
export function startSavingDeletedChannels(): void {
	stopped = false;
	void load().then(() => {
		if (!stopped) unsubscribe = onDeletedChannelsChange(() => void save());
	});
}

/**
 * @description Stops saving the deleted channels.
 */
export function stopSavingDeletedChannels(): void {
	stopped = true;
	unsubscribe?.();
	unsubscribe = undefined;
}
