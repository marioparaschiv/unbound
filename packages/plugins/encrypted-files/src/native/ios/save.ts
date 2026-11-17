import type { NativeBridge } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';
import { Share } from 'react-native';

import { toBase64 } from '~/lib/key-text';

const FOLDER = 'Unbound/Temp/unbound.encrypted-files';

/**
 * @description Writes a decrypted file to temporary storage and opens the share sheet with it.
 * @param _native The plugin's native bridge.
 * @param name The file's name.
 * @param bytes The file.
 * @returns The file's name, for the toast.
 */
export async function saveOnIOS(
	_native: NativeBridge,
	name: string,
	bytes: Uint8Array,
): Promise<string> {
	const path = `${FOLDER}/${Date.now()}/${name.replace(/[/\\]/g, '_')}`;

	await fs.writeFile(path, toBase64(bytes), 'base64');
	await Share.share({ url: `file://${fs.documentsPath}/${path}` });

	return name;
}
