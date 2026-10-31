type Signature = {
	offset: number;
	bytes: number[];
};

function ascii(text: string): number[] {
	return [...new TextEncoder().encode(text)];
}

const SIGNATURES: Record<string, Signature[]> = {
	png: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
	jpg: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
	jpeg: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
	gif: [{ offset: 0, bytes: ascii('GIF8') }],
	webp: [
		{ offset: 0, bytes: ascii('RIFF') },
		{ offset: 8, bytes: ascii('WEBP') },
	],
	mp4: [{ offset: 4, bytes: ascii('ftyp') }],
	webm: [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
};

// A WebM file is Matroska with this doctype in its EBML header, which fits in its first bytes.
const WEBM_DOCTYPE = ascii('webm');
const EBML_HEADER_BYTES = 64;

function hasBytes(data: Uint8Array, offset: number, bytes: number[]): boolean {
	return bytes.every((byte, index) => data[offset + index] === byte);
}

function hasWebmDoctype(data: Uint8Array): boolean {
	const header = data.subarray(0, EBML_HEADER_BYTES);

	return header.some((_, index) => hasBytes(header, index, WEBM_DOCTYPE));
}

/**
 * @description Checks that a media file's contents are the format its extension names.
 * @param path The file's path, ending in its extension.
 * @param data The file's bytes.
 * @returns Whether the bytes start the way that format does.
 */
export function matchesMediaFormat(path: string, data: Uint8Array): boolean {
	const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
	const signatures = SIGNATURES[extension];

	if (!signatures?.every(({ offset, bytes }) => hasBytes(data, offset, bytes))) {
		return false;
	}

	return extension !== 'webm' || hasWebmDoctype(data);
}

export default { matchesMediaFormat };
