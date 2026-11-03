import { patcher } from '@unbound-app/api';

import { Messages } from '~/modules';
import type { Upload, UploadChoices } from '~/uploads';
import { skip } from '~/skip';

type SendOptions = {
	attachmentsToUpload?: unknown;
};

/**
 * @description Applies each attachment's anonymise choice as the message is sent, which covers files Discord uploaded before the choice was changed.
 * @param choices The per-upload anonymise choices.
 * @returns A function that removes the patch.
 */
export function patchMessages(choices: UploadChoices): () => void {
	if (typeof Messages?._sendMessage !== 'function') {
		skip('renaming at send, Messages has no _sendMessage method');

		return () => undefined;
	}

	return patcher.before(Messages, '_sendMessage', ({ args }) => {
		const attachments = (args[2] as SendOptions | undefined)?.attachmentsToUpload;

		if (!Array.isArray(attachments)) return;

		for (const upload of attachments as Upload[]) choices.apply(upload);
	});
}

export default patchMessages;
