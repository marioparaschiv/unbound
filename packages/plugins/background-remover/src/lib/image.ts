export type ImageAttachment = {
	url?: string;
	content_type?: string;
	filename?: string;
};

const IMAGE = /\.(png|jpe?g|webp|heic|heif)(\?|$)/i;

/**
 * @description Finds a message's first still image.
 * @param attachments The message's attachments.
 * @returns The image, or `undefined` for a message without one.
 */
export function imageOf(attachments: ImageAttachment[] | undefined): ImageAttachment | undefined {
	return (attachments ?? []).find(
		(attachment) =>
			Boolean(attachment.url) &&
			((attachment.content_type?.startsWith('image/') &&
				attachment.content_type !== 'image/gif') ||
				IMAGE.test(attachment.filename ?? attachment.url ?? '')),
	);
}

/**
 * @description Names the cutout after the image: `cat.jpg` becomes `cat-cutout.png`.
 * @param filename The image's file name.
 * @returns The cutout's file name.
 */
export function cutoutName(filename: string | undefined): string {
	const base = (filename ?? 'image').replace(/\.[^.]+$/, '') || 'image';

	return `${base}-cutout.png`;
}

export default { imageOf, cutoutName };
