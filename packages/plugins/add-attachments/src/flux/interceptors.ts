import { flux } from '@unbound-app/api';

import { CloudUploader, REST } from '~/lib/modules';
import { canAddAttachments } from '~/lib/eligibility';
import { canAttachIn } from '~/lib/permissions';
import { addAttachments } from '~/lib/uploads';

const EditMessageStore = flux.getStore('EditMessage');
const UserStore = flux.getStore('User');

/**
 * @description While you edit a message, files you pick, take or paste in the chat input are added to that message instead of waiting for the next one.
 * Intercepts `UPLOAD_ATTACHMENT_ADD_FILES` and reads the edited message from `EditMessageStore`. Uploads with `CloudUploader` and sends the edit through `REST`.
 */
export function interceptUploadAddFiles(): void {
	if (!CloudUploader || !REST) {
		logger.warn('Editing skipped: Discord moved CloudUploader or REST.');

		return;
	}

	flux.interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', ({ channelId, files }) => {
		if (!channelId || !Array.isArray(files) || !files.length) return false;

		const message = EditMessageStore.getEditingMessage(channelId);

		if (
			!message ||
			!canAddAttachments(message, UserStore.getCurrentUser?.()?.id) ||
			!canAttachIn(channelId)
		) {
			return false;
		}

		void addAttachments(channelId, message.id, files);

		return true;
	});
}
