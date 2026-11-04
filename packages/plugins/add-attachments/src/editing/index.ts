import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { flux } from '@unbound-app/api';

import { EditMessageStore, UserStore } from '~/editing/modules';
import { CloudUploader, REST } from '~/uploads/modules';
import { canAddAttachments } from '~/uploads/eligibility';
import { canAttachIn } from '~/uploads/permissions';
import { addAttachments } from '~/uploads';
import { PLUGIN_NAME } from '~/constants';

/**
 * @description While you edit a message, files you pick, take or paste in the chat input are added to that message instead of waiting for the next one.
 * Intercepts `UPLOAD_ATTACHMENT_ADD_FILES` and reads the edited message from `EditMessageStore`. Uploads with `CloudUploader` and sends the edit through `REST`. `stop` calls the returned function, which keeps the health count in step with what is applied.
 * @returns A function that removes the interceptor.
 */
export function startEditUploads(): () => void {
	if (!ensureModules(`${PLUGIN_NAME}: editing`, { CloudUploader, EditMessageStore, REST })) {
		return () => undefined;
	}

	const remove = flux.interceptAction('UPLOAD_ATTACHMENT_ADD_FILES', ({ channelId, files }) => {
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

	return () => {
		remove();
	};
}
