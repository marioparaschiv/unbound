import { toasts } from '@unbound-app/api';

import { COMPLETED_UPLOAD, PLUGIN_NAME } from '~/constants';
import { CloudUploader, MessageStore, REST } from '~/discord/modules';
import { attachmentLimitProblem } from '~/uploads/eligibility';
import type { UploadItem } from '~/types';

type CloudUpload = {
	filename: string;
	uploadedFilename?: string;
	status: string;
	upload(): Promise<void>;
};

function notify(content: string): void {
	toasts.show({ title: PLUGIN_NAME, content });
}

async function uploadFiles(
	channelId: string,
	items: readonly UploadItem[],
): Promise<CloudUpload[]> {
	const uploads: CloudUpload[] = items.map(
		(item, index) => new CloudUploader.CloudUpload(item, channelId, index, true),
	);

	await Promise.all(uploads.map((upload) => upload.upload()));

	if (uploads.some((upload) => upload.status !== COMPLETED_UPLOAD || !upload.uploadedFilename)) {
		throw new Error('An attachment failed to upload.');
	}

	return uploads;
}

/**
 * @description Uploads files and adds them to a sent message by editing it, keeping its existing attachments.
 * Uploads with Discord's `CloudUpload`, then sends `PATCH /channels/{channel}/messages/{message}` through Discord's REST client.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param items The files to add.
 * @returns A promise that settles once the message is edited. Failures are shown in a toast.
 */
export async function addAttachments(
	channelId: string,
	messageId: string,
	items: readonly UploadItem[],
): Promise<void> {
	const message = MessageStore.getMessage(channelId, messageId);

	if (!message || !items.length) return;

	const problem = attachmentLimitProblem(message, items.length);

	if (problem) {
		notify(problem);

		return;
	}

	notify('Uploading, this can take a while...');

	try {
		const uploads = await uploadFiles(channelId, items);
		const latest = MessageStore.getMessage(channelId, messageId) ?? message;

		await REST.patch({
			url: `/channels/${channelId}/messages/${messageId}`,
			body: {
				attachments: [
					...(latest.attachments ?? []),
					...uploads.map((upload, index) => ({
						id: String(index),
						filename: upload.filename,
						uploaded_filename: upload.uploadedFilename,
					})),
				],
			},
		});

		notify(`${items.length === 1 ? 'Attachment' : 'Attachments'} added successfully!`);
	} catch (error) {
		notify(error instanceof Error ? error.message : 'The attachments could not be added.');
	}
}

export default addAttachments;
