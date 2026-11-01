import {
	BADGE_IMAGE_MAX_BYTES,
	BADGE_IMAGE_MAX_LABEL,
	BADGE_IMAGE_MAX_SIZE,
	BADGE_IMAGE_MIN_SIZE,
	BADGE_IMAGE_TYPE,
} from '@unbound-app/contracts/sponsors';

/**
 * @description Checks a picked badge image in the browser before uploading it, by the rules the server
 * enforces: PNG, at most the byte limit, square, with sides in the allowed range.
 * @param file The picked file.
 * @returns The rule it breaks, or `undefined` when it can be uploaded.
 */
export async function checkBadgeFile(file: File): Promise<string | undefined> {
	if (file.type !== BADGE_IMAGE_TYPE) {
		return 'Badge images must be PNG files.';
	}

	if (file.size > BADGE_IMAGE_MAX_BYTES) {
		return `Badge images must be ${BADGE_IMAGE_MAX_LABEL} or smaller; this one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
	}

	const bitmap = await createImageBitmap(file).catch(() => undefined);

	if (!bitmap) {
		return 'This PNG could not be opened.';
	}

	const { width, height } = bitmap;

	bitmap.close();

	if (width !== height) {
		return `Badge images must be square; this one is ${width}×${height} px.`;
	}

	if (width < BADGE_IMAGE_MIN_SIZE || width > BADGE_IMAGE_MAX_SIZE) {
		return `Badge images must be ${BADGE_IMAGE_MIN_SIZE} to ${BADGE_IMAGE_MAX_SIZE} px wide; this one is ${width} px.`;
	}
}

export default checkBadgeFile;
