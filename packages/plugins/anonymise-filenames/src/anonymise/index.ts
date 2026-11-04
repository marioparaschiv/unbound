import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';
import { settings } from '@unbound-app/settings';

import { patchUploadPreviewSheet } from '~/anonymise/preview-sheet';
import { patchCloudUpload } from '~/anonymise/cloud-upload';
import { createUploadChoices } from '~/anonymise/uploads';
import { patchSend } from '~/anonymise/send';
import { PLUGIN_NAME } from '~/constants';

/**
 * @description Sends uploaded files under an anonymous name, and adds a per-file switch to the upload preview sheet.
 * Patches `CloudUpload.prototype.upload` once its module loads and `Messages._sendMessage`, and renders a row into
 * `UploadPreviewActionSheet` (`modules/media_uploads/native/UploadPreviewActionSheet.tsx`).
 * The Addon scope removes the patches and module waits when the plugin stops.
 * A patch that throws, such as on an unexpected sheet shape, is logged and recorded, and the others still apply.
 */
export function startAnonymise(): void {
	const choices = createUploadChoices(() => settings);

	const failures: string[] = [];
	let applied = 0;

	for (const patch of [patchCloudUpload, patchSend, patchUploadPreviewSheet]) {
		try {
			patch(choices);
			applied++;
		} catch (error) {
			console.error(`[${PLUGIN_NAME}] Failed to apply ${patch.name}:`, error);
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}

	recordApplied(applied);

	// Recorded last: counting applied patches clears a recorded failure.
	if (failures.length) recordFailure(failures.join('; '));
}
