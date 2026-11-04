import { format, messages } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import { CloudUploader, Messages, PendingReplyStore } from '~/commands/modules';
import { getOptionValue, renderTagMessage } from '~/commands/tags';
import type { CommandOption, TagMedia } from '~/commands/tags';
import type { CommandContext } from '~/commands/commands';
import { notify, notifyError } from '~/commands/notify';
import { getTags } from '~/commands/saved-commands';
import { mediaUri } from '~/commands/media';

type CloudUpload = {
	status: string;
	upload: () => Promise<void>;
};

async function uploadMedia(media: TagMedia[], channelId: string): Promise<CloudUpload[]> {
	if (!media.length) return [];

	if (!CloudUploader.CloudUpload) {
		throw new Error(messages.UPLOADS_UNAVAILABLE);
	}

	const uploads: CloudUpload[] = media.map((item, index) => {
		const uri = mediaUri(item);
		const file = {
			id: `custom-commands-${Date.now()}-${index}`,
			origin: 1,
			uri,
			originalUri: uri,
			mimeType: item.mimeType,
			width: item.width,
			height: item.height,
			filename: item.fileName,
			playableDuration: item.duration ?? null,
			platform: 0,
			createdUsingInAppCamera: false,
			progress: 0,
		};

		return new CloudUploader.CloudUpload(file, channelId, index, true);
	});

	await Promise.all(uploads.map((upload) => upload.upload()));

	if (uploads.some((upload) => upload.status !== 'COMPLETED')) {
		throw new Error(messages.UPLOAD_FAILED);
	}

	return uploads;
}

/**
 * @description Sends a saved command's response, as a message with its attachments or as an ephemeral bot message.
 * @param name The command's name; the latest saved version is sent.
 * @param options The options Discord passed to the command.
 * @param context The channel the command ran in.
 * @returns A promise that settles once the message is sent. On failure it shows a toast and rejects.
 */
export async function sendTag(
	name: string,
	options: CommandOption[],
	context: CommandContext,
): Promise<void> {
	const tag = getTags().find((entry) => entry.name === name);
	const channelId = context.channel?.id;

	if (!tag || !channelId) return;

	const ephemeral = getOptionValue(options, 'ephemeral') === true;
	const content = renderTagMessage(tag.message, options);

	if (ephemeral && tag.media.length) {
		notify(messages.EPHEMERAL_WITH_ATTACHMENTS);

		return;
	}

	try {
		if (ephemeral) {
			Messages.sendBotMessage(channelId, { content });

			return;
		}

		// Optional: without the reply store, commands send as plain messages.
		const pendingReply = PendingReplyStore.getPendingReply?.(channelId);
		const replyOptions = Messages.getSendMessageOptionsForReply?.(pendingReply) ?? {};
		const attachmentsToUpload = await uploadMedia(tag.media, channelId);
		const result = await Messages._sendMessage(
			channelId,
			{ content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] },
			{ ...replyOptions, attachmentsToUpload },
		);

		if (result?.ok === false) {
			throw new Error(format('MESSAGE_REJECTED', { status: result.status }));
		}

		if (pendingReply) {
			void flux.dispatch({ type: 'DELETE_PENDING_REPLY', channelId });
		}
	} catch (error) {
		notifyError(error, messages.SEND_FAILED);

		throw error;
	}
}

export default { sendTag };
