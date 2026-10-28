export type SharedFile = {
	uri: string;
	path: string;
	filename: string;
	mimeType: string;
};

const SHARE_LINK = /^(?:discord|unbound):\/\/share\/?(?:\?(.*))?$/i;
const MAX_DECODES = 4;
const MAX_SHARED_FILES = 10;

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

// The extension percent-encodes each file URL before URLComponents encodes the query again, so a
// value can arrive encoded more than once; decode until it reads as a file URL.
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

/**
 * @description Reads the files a share extension handed over in a `discord://share?url=…` (or `unbound://share`) link.
 * @param url The opened URL.
 * @returns The shared local files, or `undefined` when the URL is not a share link.
 */
export function parseShareLink(url: string): SharedFile[] | undefined {
	const match = SHARE_LINK.exec(url.trim());

	if (!match) return;

	const files: SharedFile[] = [];

	for (const pair of (match[1] ?? '').split('&')) {
		const separator = pair.indexOf('=');
		const name = separator < 0 ? pair : pair.slice(0, separator);

		if (decode(name) !== 'url' || separator < 0) {
			continue;
		}

		const uri = fileURLOf(pair.slice(separator + 1));
		const file = uri ? sharedFile(uri) : undefined;

		if (file && !files.some((existing) => existing.uri === file.uri)) {
			files.push(file);
		}

		if (files.length === MAX_SHARED_FILES) {
			break;
		}
	}

	return files;
}

export default parseShareLink;
