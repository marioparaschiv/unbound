import { fs } from '@unbound-app/api';

const BASE64_CHUNK = 0x8000;
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * @description Whether an attachment is a PDF, by its file name.
 * @param fileName The attachment's file name.
 * @returns `true` for a `.pdf` file.
 */
export function isPdf(fileName: string | undefined): boolean {
	return /\.pdf$/i.test(fileName ?? '');
}

/**
 * @description Makes a file name safe to write, keeping its `.pdf` ending.
 * @param fileName The attachment's file name.
 * @returns A name of letters, digits, dots, dashes and underscores.
 */
export function safeFileName(fileName: string): string {
	const cleaned = fileName.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '');

	return isPdf(cleaned) ? cleaned : `${cleaned || 'document'}.pdf`;
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';

	for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK));
	}

	return btoa(binary);
}

/**
 * @description Downloads a PDF into a folder in the documents directory.
 * @param url The PDF's link.
 * @param folder The folder, relative to the documents directory.
 * @param fileName The name to save it under.
 * @returns The file's absolute path.
 */
export async function downloadPdf(url: string, folder: string, fileName: string): Promise<string> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const bytes = new Uint8Array(await response.arrayBuffer());

	if (bytes.byteLength > MAX_BYTES) throw new Error('the PDF is over 50 MB');

	const path = `${folder}/${Date.now()}/${safeFileName(fileName)}`;

	await fs.writeFile(path, toBase64(bytes), 'base64');

	return `${fs.documentsPath}/${path}`;
}

const ATTACHMENT_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

/**
 * @description Reads the file name of a tapped link when it points at a Discord attachment, which is how iOS hands over
 * a tap on a file in chat.
 * @param url The tapped link.
 * @returns The attachment's file name, or `undefined` for any other link.
 */
export function attachmentFileName(url: string): string | undefined {
	try {
		const { hostname, pathname } = new URL(url);

		if (!ATTACHMENT_HOSTS.has(hostname) || !pathname.startsWith('/attachments/'))
			return undefined;

		return decodeURIComponent(pathname.split('/').pop() ?? '') || undefined;
	} catch {
		return undefined;
	}
}

export default { isPdf, safeFileName, downloadPdf, attachmentFileName };
