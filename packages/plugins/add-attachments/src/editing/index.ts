import { flux } from '@unbound-app/api';

import { EditMessageStore, UserStore } from '~/discord/modules';
import { canAddAttachments } from '~/uploads/eligibility';
import { canAttachIn } from '~/uploads/permissions';
import { addAttachments } from '~/uploads';
import type { UploadItem } from '~/types';

type AddFilesAction = {
	channelId?: string;
	files?: UploadItem[];
};

/**
 * @description While you edit a message, files you pick, take or paste in the chat input are added to that message instead of waiting for the next one.
 * Intercepts `UPLOAD_ATTACHMENT_ADD_FILES` and reads the edited message from `EditMessageStore`.
 * @returns A function that removes the interceptor.
 */
export function interceptEditUploads(): () => void {
	return flux.interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', (action) => {
		const { channelId, files } = action as AddFilesAction;

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

export default interceptEditUploads;
