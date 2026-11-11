import { patcher } from '@unbound-app/api';

import { patchCloudUpload, patchSendMessage, patchUploadPreviewSheet } from '~/patches';
import { resetUploadChoices } from '~/lib/choices';

export function start() {
	resetUploadChoices();
	patchCloudUpload();
	patchSendMessage();
	patchUploadPreviewSheet();
}

export function stop() {
	patcher.unpatchAll();
}
