export type SharedFile = {
	uri: string;
	path: string;
	filename: string;
	mimeType: string;
};

/** What a share extension hands over: local files, and the text or links that were shared with them. */
export type SharedContent = {
	files: SharedFile[];
	text?: string;
};

const SHARE_LINK = /^(?:discord|unbound):\/\/share\/?(?:\?(.*))?$/i;
const MAX_DECODES = 4;
const MAX_SHARED_FILES = 10;
const MAX_SHARED_TEXT = 4000;

const MIME_TYPES: Record<string, string> = {
	aac: 'audio/aac',
	gif: 'image/gif',
	heic: 'image/heic',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	m4a: 'audio/mp4',
	m4v: 'video/x-m4v',
	mov: 'video/quicktime',
	mp3: 'audio/mpeg',
	mp4: 'video/mp4',
	pdf: 'application/pdf',
	png: 'image/png',
	wav: 'audio/wav',
	webp: 'image/webp',
};

function decode(text: string): string | undefined {
	try {
		return decodeURIComponent(text.replaceAll('+', '%20'));
	} catch {
		return undefined;
	}
}

function fileURLOf(value: string): string | undefined {
	let current = value;

	for (let pass = 0; pass < MAX_DECODES; pass++) {
		if (/^file:\/\//i.test(current) && !/%25/i.test(current)) {
			return current;
		}

		const next = decode(current);

		if (!next || next === current) {
			break;
		}

		current = next;
	}

	return /^file:\/\//i.test(current) ? current : undefined;
}

function sharedFile(uri: string): SharedFile | undefined {
	const path = decode(uri.replace(/^file:\/\//i, ''));

	if (!path?.startsWith('/') || path.split('/').includes('..')) return;

	const filename = path.slice(path.lastIndexOf('/') + 1);

	if (!filename) return;

	const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : '';

	return {
		uri,
		path,
		filename,
		mimeType: MIME_TYPES[extension.toLowerCase()] ?? 'application/octet-stream',
	};
}

function sharedText(value: string): string | undefined {
	const text = decode(value)?.trim();

	return text ? text.slice(0, MAX_SHARED_TEXT) : undefined;
}

/**
 * @description Reads what a share extension handed over in a `discord://share?url=…&text=…` (or `unbound://share`) link:
 * local files as `url`, shared text and web links as `text`.
 * @param url The opened URL.
 * @returns The shared files and text, or `undefined` when the URL is not a share link.
 */
export function parseShareLink(url: string): SharedContent | undefined {
	const match = SHARE_LINK.exec(url.trim());

	if (!match) return;

	const files: SharedFile[] = [];
	let text: string | undefined;

	for (const pair of (match[1] ?? '').split('&')) {
		const separator = pair.indexOf('=');
		const name = separator < 0 ? pair : decode(pair.slice(0, separator));

		if (separator < 0) {
			continue;
		}

		if (name === 'text') {
			text ??= sharedText(pair.slice(separator + 1));

			continue;
		}

		if (name !== 'url' || files.length === MAX_SHARED_FILES) {
			continue;
		}

		const uri = fileURLOf(pair.slice(separator + 1));
		const file = uri ? sharedFile(uri) : undefined;

		if (file && !files.some((existing) => existing.uri === file.uri)) {
			files.push(file);
		}
	}

	return text ? { files, text } : { files };
}

export default parseShareLink;
