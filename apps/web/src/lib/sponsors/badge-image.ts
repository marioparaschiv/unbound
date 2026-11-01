import {
	BADGE_IMAGE_MAX_BYTES,
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

/**
 * @description Checks an uploaded badge image: a complete, still PNG, square, with sides from
 * {@link BADGE_IMAGE_MIN_SIZE} to {@link BADGE_IMAGE_MAX_SIZE} px and at most {@link BADGE_IMAGE_MAX_BYTES}.
 * @param bytes The file's bytes.
 * @returns The rule the image breaks, or `undefined` when it is a valid badge image.
 */
export function findBadgeImageProblem(bytes: Uint8Array): string | undefined {
	if (bytes.byteLength > BADGE_IMAGE_MAX_BYTES) {
		return `Badge images must be ${BADGE_IMAGE_MAX_BYTES / 1024} KB or smaller.`;
	}

	if (!matchesMediaFormat('badge.png', bytes)) {
		return 'Badge images must be PNG files.';
	}

	const chunks = readChunks(bytes);
	const header = chunks?.[0];
	const firstData = chunks?.findIndex((chunk) => chunk.type === 'IDAT') ?? -1;

	if (!chunks || header?.type !== 'IHDR' || header.data.byteLength !== 13 || firstData < 0) {
		return 'The badge image is not a complete PNG file.';
	}

	// APNG declares its frames in an `acTL` chunk ahead of the image data.
	if (chunks.slice(0, firstData).some((chunk) => chunk.type === 'acTL')) {
		return 'Badge images must be still; animated PNGs are not allowed.';
	}

	const view = new DataView(header.data.buffer, header.data.byteOffset, 8);
	const width = view.getUint32(0);
	const height = view.getUint32(4);

	if (width !== height) {
		return `Badge images must be square; this one is ${width}×${height} px.`;
	}

	if (width < BADGE_IMAGE_MIN_SIZE || width > BADGE_IMAGE_MAX_SIZE) {
		return `Badge images must be ${BADGE_IMAGE_MIN_SIZE} to ${BADGE_IMAGE_MAX_SIZE} px wide; this one is ${width} px.`;
	}
}

/**
 * @description Names a badge image: the lowercase hex SHA-256 of its bytes.
 * @param bytes The PNG's bytes.
 * @returns The image's hash.
 */
export function hashBadgeImage(bytes: Uint8Array): string {
	return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

/**
 * @description The public bucket key a badge image is stored at, derived from its hash so the same
 * bytes always land on the same key.
 * @param image The image's hash.
 * @returns The key.
 */
export function getBadgeImageKey(image: string): string {
	return `badges/${image}.png`;
}

export default { findBadgeImageProblem, hashBadgeImage, getBadgeImageKey };
