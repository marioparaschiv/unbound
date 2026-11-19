import type { NativeBridge } from '@unbound-app/api/native';

const PLAYABLE_SCHEMES = ['content://', 'file://'];

/**
 * @description Android's media picker already gives a playable address.
 * @param _native The plugin's native bridge.
 * @param uri The media picker's address.
 * @returns The address when the player can open it.
 */
export function videoFileAndroid(_native: NativeBridge, uri: string): Promise<string | undefined> {
	return Promise.resolve(
		PLAYABLE_SCHEMES.some((scheme) => uri.startsWith(scheme)) ? uri : undefined,
	);
}

export default videoFileAndroid;
