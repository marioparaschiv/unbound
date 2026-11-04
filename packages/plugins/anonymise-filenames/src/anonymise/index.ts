import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import { settings } from '@unbound-app/settings';

import { patchUploadPreviewSheet } from '~/anonymise/preview-sheet';
import { patchCloudUpload } from '~/anonymise/cloud-upload';
import { createUploadChoices } from '~/anonymise/uploads';
import { patchSend } from '~/anonymise/send';

/**
 * @description Sends uploaded files under an anonymous name, and adds a per-file switch to the upload preview sheet.
 * Patches `CloudUpload.prototype.upload` once its module loads and `Messages._sendMessage`, and renders a row into
 * `UploadPreviewActionSheet` (`modules/media_uploads/native/UploadPreviewActionSheet.tsx`).
 * The Addon scope removes the patches and module waits when the plugin stops.
 */
export function startAnonymise(): void {
	const choices = createUploadChoices(() => settings);

	patchCloudUpload(choices);
	patchSend(choices);
	patchUploadPreviewSheet(choices);

	recordApplied(1);
}
