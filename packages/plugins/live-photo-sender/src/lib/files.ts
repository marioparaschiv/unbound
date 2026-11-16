export type UploadFile = {
	id: string;
	uri: string;
	originalUri?: string;
	filename?: string;
	mimeType?: string;
	width?: number;
	height?: number;
	playableDuration?: number | null;
} & Record<string, unknown>;

export type SendAs = 'still' | 'video' | 'gif';

const LOCAL_IDENTIFIER = /^[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}\/L0\/\d{3}$/i;

/**
 * @description Reads the photo library identifier of a picked file: from its `ph://` address, or from its id once
 * another plugin, such as Photo Metadata, has swapped the address for a copy.
 * @param file The picked file's address and id.
 * @returns The identifier, or `undefined` for a file that isn't from the photo library.
 */
export function libraryIdentifier({ uri, id }: { uri?: string; id?: string }): string | undefined {
	if (uri?.startsWith('ph://')) return uri.slice('ph://'.length);

	return id && LOCAL_IDENTIFIER.test(id) ? id : undefined;
}

function baseName(filename: string | undefined): string {
	return (filename ?? 'live-photo').replace(/\.[^.]+$/, '') || 'live-photo';
}

/**
 * @description Describes the file a Live Photo becomes when sent as its video or as a GIF.
 * @param file The picked photo.
 * @param sendAs What to send it as.
 * @param path The converted file's absolute path.
 * @param size The converted file's width and height, when known.
 * @returns The upload entry that replaces the photo.
 */
export function convertedFile(
	file: UploadFile,
	sendAs: Exclude<SendAs, 'still'>,
	path: string,
	size?: { width: number; height: number },
): UploadFile {
	const uri = `file://${path}`;
	const isVideo = sendAs === 'video';

	return {
		...file,
		id: `${file.id}-${sendAs}`,
		uri,
		originalUri: uri,
		filename: `${baseName(file.filename)}.${isVideo ? 'mov' : 'gif'}`,
		mimeType: isVideo ? 'video/quicktime' : 'image/gif',
		...size,
	};
}

export default { libraryIdentifier, convertedFile };
