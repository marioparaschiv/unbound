import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createPhotoTools as android } from '~/native/android/photos';
import type { PhotoMetadata, UploadFile } from '~/lib/metadata';
import { createPhotoTools as ios } from '~/native/ios/photos';

export type CleanedFile = { uri: string; filename: string; mimeType: string };

export type PhotoTools = {
	inspect(file: UploadFile): Promise<PhotoMetadata>;
	strip(
		file: UploadFile,
		metadata: PhotoMetadata,
		folder: string,
	): Promise<CleanedFile | undefined>;
};

const createPlatformTools = native.definePlatform({ ios, android });

/**
 * @description Creates this platform's photo metadata reader and remover.
 * @param bridge The plugin's native bridge.
 * @returns The tools, or `undefined` on a platform without them.
 */
export function createPhotoTools(bridge: NativeBridge): PhotoTools | undefined {
	return createPlatformTools(bridge) ?? undefined;
}

export default { createPhotoTools };
