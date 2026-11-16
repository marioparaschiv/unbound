const TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	heic: 'image/heic',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
	webm: 'video/webm',
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	ogg: 'audio/ogg',
	pdf: 'application/pdf',
	txt: 'text/plain',
	zip: 'application/zip',
};

/**
 * @description Guesses a file's type from its extension, for hosts that read it from the upload.
 * @param filename The file's name.
 * @returns The type, or a generic binary type.
 */
export function mimeTypeOf(filename: string): string {
	return TYPES[filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

export default { mimeTypeOf };
