import { createLogger } from '@unbound-app/logger';

import { diskFullMessage, shouldWarnAboutDiskFull } from '~/core/disk-full';
import { getLoader } from '~/native/unbound-native';
import { onAction } from '~/flux/api';
import { show } from '~/toasts/api';

const Logger = createLogger('DiskFull');

let warnedAt: number | undefined;
let unsubscribe: (() => void) | null = null;

function warnIfFull() {
	const note = getLoader()?.launch?.diskFull;

	if (!shouldWarnAboutDiskFull(note, warnedAt)) {
		return;
	}

	warnedAt = note.at;
	Logger.warn(`Failed to save ${note.file}: the device is out of storage.`);
	show({ id: 'disk-full', title: 'Storage full', content: diskFullMessage(note), duration: 0 });
}

/**
 * @description Warns once when the loader could not save a file because the device is out of storage, checking at
 * start and each time Discord comes back to the front.
 */
export function start() {
	warnIfFull();
	unsubscribe = onAction('APP_STATE_UPDATE', ({ state }) => {
		if (state === 'active') {
			warnIfFull();
		}
	});
}

/**
 * @description Stops checking for a full disk.
 */
export function stop() {
	unsubscribe?.();
	unsubscribe = null;
}

export default { start, stop };
