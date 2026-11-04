import {
	BADGE_IMAGE_MAX_BYTES,
	BADGE_IMAGE_MAX_LABEL,
	BADGE_IMAGE_MAX_SIZE,
	BADGE_IMAGE_MIN_SIZE,
} from '@unbound-app/contracts/sponsors';

import { matchesMediaFormat } from '~/lib/media-format';

const SIGNATURE_BYTES = 8;
// Each chunk is a 4-byte length, a 4-byte type, its data, then a 4-byte CRC.
const CHUNK_OVERHEAD = 12;

type Chunk = {
	type: string;
	data: Uint8Array;
};

// `undefined` when a chunk runs past the end of the file or `IEND` is missing, as in a truncated upload.
function readChunks(bytes: Uint8Array): Chunk[] | undefined {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const chunks: Chunk[] = [];
	let offset = SIGNATURE_BYTES;

	while (offset + CHUNK_OVERHEAD <= bytes.byteLength) {
		const length = view.getUint32(offset);
		const end = offset + CHUNK_OVERHEAD + length;

		if (end > bytes.byteLength) return;

		const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));

		chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });

		if (type === 'IEND') {
			return chunks;
		}

		offset = end;
	}
}

/** The formats a badge image can be stored as. */
export type BadgeImageFormat = 'png' | 'gif';

const CONTENT_TYPES: Record<BadgeImageFormat, string> = {
	png: 'image/png',
	gif: 'image/gif',
};

// A GIF's logical screen size follows its 6-byte `GIF87a`/`GIF89a` header, as two little-endian words.
const GIF_HEADER_BYTES = 10;
const GIF_TRAILER = 0x3b;

/**
 * @description Reads which badge image format a file's bytes are.
 * @param bytes The file's bytes.
 * @returns The format, or `undefined` when it is neither a PNG nor a GIF.
 */
export function readBadgeImageFormat(bytes: Uint8Array): BadgeImageFormat | undefined {
	if (matchesMediaFormat('badge.png', bytes)) {
		return 'png';
	}

	if (matchesMediaFormat('badge.gif', bytes)) {
		return 'gif';
	}
}

function findSizeProblem(width: number, height: number): string | undefined {
	if (width !== height) {
		return `Badge images must be square; this one is ${width}×${height} px.`;
	}

	if (width < BADGE_IMAGE_MIN_SIZE || width > BADGE_IMAGE_MAX_SIZE) {
		return `Badge images must be ${BADGE_IMAGE_MIN_SIZE} to ${BADGE_IMAGE_MAX_SIZE} px wide; this one is ${width} px.`;
	}
}

function findGifProblem(bytes: Uint8Array): string | undefined {
	if (bytes.byteLength <= GIF_HEADER_BYTES || bytes.at(-1) !== GIF_TRAILER) {
		return 'The badge image is not a complete GIF file.';
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, GIF_HEADER_BYTES);

	return findSizeProblem(view.getUint16(6, true), view.getUint16(8, true));
}

/**
 * @description Checks an uploaded badge image: a complete still PNG or a GIF, which may be animated,
 * square, with sides from {@link BADGE_IMAGE_MIN_SIZE} to {@link BADGE_IMAGE_MAX_SIZE} px and at most
 * {@link BADGE_IMAGE_MAX_BYTES}.
 * @param bytes The file's bytes.
 * @returns The rule the image breaks, or `undefined` when it is a valid badge image.
 */
export function findBadgeImageProblem(bytes: Uint8Array): string | undefined {
	if (bytes.byteLength > BADGE_IMAGE_MAX_BYTES) {
		return `Badge images must be ${BADGE_IMAGE_MAX_LABEL} or smaller.`;
	}

	const format = readBadgeImageFormat(bytes);

	if (format === 'gif') {
		return findGifProblem(bytes);
	}

	if (format !== 'png') {
		return 'Badge images must be PNG or GIF files.';
	}

	const chunks = readChunks(bytes);
	const header = chunks?.[0];
	const firstData = chunks?.findIndex((chunk) => chunk.type === 'IDAT') ?? -1;

	if (!chunks || header?.type !== 'IHDR' || header.data.byteLength !== 13 || firstData < 0) {
		return 'The badge image is not a complete PNG file.';
	}

	// APNG declares its frames in an `acTL` chunk ahead of the image data.
	if (chunks.slice(0, firstData).some((chunk) => chunk.type === 'acTL')) {
		return 'Animated PNGs are not allowed; upload the animation as a GIF.';
	}

	const view = new DataView(header.data.buffer, header.data.byteOffset, 8);

	return findSizeProblem(view.getUint32(0), view.getUint32(4));
}

/**
 * @description Names a badge image: the lowercase hex SHA-256 of its bytes, then `.gif` for a GIF.
 * PNGs keep the bare hash every badge stored before GIFs refers to.
 * @param bytes The image's bytes.
 * @returns The image's name.
 */
export function hashBadgeImage(bytes: Uint8Array): string {
	const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

	return readBadgeImageFormat(bytes) === 'gif' ? `${hash}.gif` : hash;
}

function formatOf(image: string): BadgeImageFormat {
	return image.endsWith('.gif') ? 'gif' : 'png';
}

/**
 * @description The public bucket key a badge image is stored at, derived from its name so the same
 * bytes always land on the same key.
 * @param image The image's name, from {@link hashBadgeImage}.
 * @returns The key.
 */
export function getBadgeImageKey(image: string): string {
	return formatOf(image) === 'gif' ? `badges/${image}` : `badges/${image}.png`;
}

/**
 * @description The content type a stored badge image is served with.
 * @param image The image's name, from {@link hashBadgeImage}.
 * @returns `image/png` or `image/gif`.
 */
export function getBadgeImageType(image: string): string {
	return CONTENT_TYPES[formatOf(image)];
}

export default {
	readBadgeImageFormat,
	findBadgeImageProblem,
	hashBadgeImage,
	getBadgeImageKey,
	getBadgeImageType,
};
