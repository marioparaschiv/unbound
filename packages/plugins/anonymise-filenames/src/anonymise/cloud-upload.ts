import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import { CloudUploaderFilter } from '~/anonymise/modules';
import type { UploadChoices } from '~/anonymise/uploads';

/**
 * @description Renames each file as Discord starts uploading it, so the name Discord's upload service receives is already anonymous.
 * @param choices The per-upload anonymise choices.
 */
export function patchCloudUpload(choices: UploadChoices): void {
	metro.onModuleLoaded(CloudUploaderFilter, (module: AnyProps) => {
		const prototype = module.CloudUpload?.prototype;

		if (typeof prototype?.upload !== 'function') {
			skipFeature('renaming uploads: CloudUpload has no upload method');

			return;
		}

		patcher.before(prototype, 'upload', ({ this: upload }) => {
			choices.apply(upload);
		});
	});
}
