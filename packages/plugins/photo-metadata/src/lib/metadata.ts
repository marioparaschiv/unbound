export type Location = { latitude: number; longitude: number };

export type PhotoMetadata = {
	location?: Location;
	camera?: string;
	takenAt?: string;
	software?: string;
};

export type UploadFile = {
	uri: string;
	originalUri?: string;
	filename?: string;
	mimeType?: string;
};

export type Decision = 'strip' | 'warn' | 'keep';

export type MetadataSettings = { removeLocation: boolean; removeAll: boolean };

const IMAGE = /\.(jpe?g|png|heic|heif|webp|tiff?|dng)$/i;

/**
 * @description Whether an attachment is a photo whose metadata is worth checking.
 * @param file The attachment Discord is adding.
 * @returns `true` for images.
 */
export function isPhoto(file: UploadFile): boolean {
	return Boolean(file.mimeType?.startsWith('image/') || IMAGE.test(file.filename ?? file.uri));
}

/**
 * @description Reads a signed coordinate from EXIF's unsigned value and its N/S or E/W reference.
 * @param value The coordinate in degrees.
 * @param reference `N`, `S`, `E` or `W`.
 * @returns The coordinate, negative south and west, or `undefined` for a missing or zeroed one.
 */
export function signedCoordinate(value: unknown, reference: unknown): number | undefined {
	const number = Number(value);

	if (!Number.isFinite(number) || number === 0) return undefined;

	return reference === 'S' || reference === 'W' ? -number : number;
}

/**
 * @description Reads the location from a latitude and longitude pair, when both are there.
 * @param latitude The signed latitude.
 * @param longitude The signed longitude.
 * @returns The location, or `undefined`.
 */
export function locationOf(
	latitude: number | undefined,
	longitude: number | undefined,
): Location | undefined {
	return latitude === undefined || longitude === undefined ? undefined : { latitude, longitude };
}

/**
 * @description Whether a photo carries anything the plugin reports.
 * @param metadata What was read from the photo.
 * @returns `true` when it has a location, camera, date or software.
 */
export function hasMetadata(metadata: PhotoMetadata): boolean {
	return Boolean(metadata.location || metadata.camera || metadata.takenAt || metadata.software);
}

/**
 * @description Decides what happens to a photo: remove its metadata, warn about its location, or leave it.
 * @param metadata What was read from the photo.
 * @param settings Whether to remove locations, and all metadata.
 * @returns The decision.
 */
export function decide(metadata: PhotoMetadata, settings: MetadataSettings): Decision {
	if (settings.removeAll && hasMetadata(metadata)) return 'strip';
	if (metadata.location) return settings.removeLocation ? 'strip' : 'warn';

	return 'keep';
}

/**
 * @description Writes a location as degrees with four decimals and a compass letter.
 * @param location The location.
 * @returns The location, such as `48.1417° N, 11.5700° E`.
 */
export function formatLocation({ latitude, longitude }: Location): string {
	const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? 'S' : 'N'}`;
	const lon = `${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? 'W' : 'E'}`;

	return `${lat}, ${lon}`;
}

/**
 * @description Swaps a file name's extension for `.jpg`, for photos re-encoded as JPEG.
 * @param filename The original name.
 * @returns The name ending in `.jpg`.
 */
export function asJpegName(filename: string): string {
	return `${filename.replace(/\.[^./]+$/, '') || 'photo'}.jpg`;
}

export default {
	isPhoto,
	signedCoordinate,
	locationOf,
	hasMetadata,
	decide,
	formatLocation,
	asJpegName,
};
