import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import { patcher } from '@unbound-app/api';

import type { Upload, UploadChoices } from '~/anonymise/uploads';
import { Messages } from '~/anonymise/modules';

type SendOptions = {
	attachmentsToUpload?: unknown;
};

/**
 * @description Applies each attachment's anonymise choice as the message is sent, which covers files Discord uploaded before the choice was changed.
 * @param choices The per-upload anonymise choices.
 */
export function patchSend(choices: UploadChoices): void {
	if (typeof Messages?._sendMessage !== 'function') {
		skipFeature('renaming at send: Messages has no _sendMessage method');

		return;
	}

	patcher.before(Messages, '_sendMessage', ({ args }) => {
		const attachments = (args[2] as SendOptions | undefined)?.attachmentsToUpload;

		if (!Array.isArray(attachments)) return;

		for (const upload of attachments as Upload[]) choices.apply(upload);
	});
}
