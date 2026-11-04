import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { patcher } from '@unbound-app/api';
import type { AnyProps } from '@unbound-app/api/metro';

import { CloudUploaderFilter } from '~/modules';
import type { UploadChoices } from '~/uploads';
import { skip } from '~/skip';

/**
 * @description Renames each file as Discord starts uploading it, so the name Discord's upload service receives is already anonymous.
 * @param choices The per-upload anonymise choices.
 * @returns A function that stops waiting for the module and removes the patch.
 */
export function patchCloudUpload(choices: UploadChoices): () => void {
	return whenLoaded<AnyProps>(CloudUploaderFilter, (module) => {
		const prototype = module.CloudUpload?.prototype;

		if (typeof prototype?.upload !== 'function') {
			skip('renaming uploads, CloudUpload has no upload method');

			return;
		}

		return patcher.before(prototype, 'upload', ({ this: upload }) => {
			choices.apply(upload);
		});
	});
}

export default patchCloudUpload;
