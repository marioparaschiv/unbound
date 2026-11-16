import { fs } from '@unbound-app/api';

import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';

export type VideoAttachment = {
	url?: string;
	filename?: string;
	content_type?: string;
};

const VIDEO = /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i;
const MAX_BYTES = 100 * 1024 * 1024;

/**
 * @description Finds a message's first video attachment.
 * @param attachments The message's attachments.
 * @returns The video, or `undefined` for a message without one.
 */
export function videoOf(attachments: VideoAttachment[] | undefined): VideoAttachment | undefined {
	return (attachments ?? []).find(
		(attachment) =>
			Boolean(attachment.url) &&
			(attachment.content_type?.startsWith('video/') ||
				VIDEO.test(attachment.filename ?? attachment.url ?? '')),
	);
}

/**
 * @description Downloads a video into a folder in the documents directory.
 * @param url The video's link.
 * @param folder The folder, relative to the documents directory.
 * @returns The video's absolute path.
 */
export async function downloadVideo(url: string, folder: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const bytes = new Uint8Array(await response.arrayBuffer());

	if (bytes.byteLength > MAX_BYTES) throw new Error('the video is over 100 MB');

	const extension = /\.(\w+)(\?|$)/.exec(url)?.[1] ?? 'mp4';
	const path = `${folder}/${Date.now()}/video.${extension}`;

	await fs.writeFile(path, toBase64(bytes), 'base64');

	return `${fs.documentsPath}/${path}`;
}

export default { videoOf, downloadVideo };
