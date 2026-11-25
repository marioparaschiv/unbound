import { createLogger } from '@unbound-app/logger';

import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byProps } from '~/metro/filters';

const Patcher = createPatcher('unbound::upload-path-guard');
const Logger = createLogger('UploadPathGuard');

type UploadItem = { uri?: string };

let stopWaiting: (() => void) | undefined;

function patchAttachmentFile(AttachmentFile: MetroExport) {
	if (typeof AttachmentFile?.canUploadNatively !== 'function') {
		Logger.warn('Upload path guard skipped: Discord moved canUploadNatively.');

		return;
	}

	Patcher.after(AttachmentFile, 'canUploadNatively', ({ args, result }) => {
		const [item] = args as [UploadItem | undefined];

		// The native uploader reads `uri` minus `file://` as a path without decoding it, so `%20` names a missing file.
		if (result && item?.uri?.includes('%')) {
			return false;
		}

		return result;
	});
}

/**
 * @description Sends attachments whose file URI holds percent escapes through Discord's JS uploader, as its native
 * uploader cannot open them. Sideloaded iOS installs copy every picked file into the app, where this path applies.
 */
export function start() {
	stopWaiting = onModuleLoaded(byProps('canUploadNatively'), patchAttachmentFile);
}

/**
 * @description Stops guarding upload paths.
 */
export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	Patcher.unpatchAll();
}

export default { start, stop };
