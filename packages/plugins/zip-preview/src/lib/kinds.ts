/** An attachment as Discord stores it on a message. */
export type Attachment = {
	filename?: string;
	url?: string;
	size?: number;
	content_type?: string;
};

const ZIP_EXTENSIONS = new Set(['zip', 'jar', 'apk', 'ipa', 'xpi', 'docx', 'xlsx', 'pptx', 'epub']);

/** The largest archive the preview loads. */
export const MAX_ZIP_BYTES = 25 * 1024 * 1024;

function extensionOf(filename: string): string {
	const dot = filename.lastIndexOf('.');

	return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

/**
 * @description Tells whether an attachment is a zip archive small enough to list.
 * @param attachment The attachment.
 * @returns Whether it can be listed.
 */
export function isListableZip(attachment: Attachment): boolean {
	const { filename = '', size = 0, content_type: type = '' } = attachment;

	if (!attachment.url || !filename || size > MAX_ZIP_BYTES) return false;

	return ZIP_EXTENSIONS.has(extensionOf(filename)) || type === 'application/zip';
}

export default isListableZip;
