import { javaReference, javaString } from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge } from '@unbound-app/api/native';

const FOLDER = 'Download/Unbound';

/**
 * @description Saves a decrypted file to Downloads/Unbound through `MediaStore`, which needs no storage permission.
 * @param native The plugin's native bridge.
 * @param name The file's name.
 * @param bytes The file.
 * @returns Where it went, for the toast.
 */
export async function saveOnAndroid(
	{ java }: NativeBridge,
	name: string,
	bytes: Uint8Array,
): Promise<string> {
	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);
	const resolver = app ? javaReference(java.invoke(app, 'getContentResolver', [])) : null;
	const values = java.construct('android.content.ContentValues', []);

	java.invoke(values, 'put', [javaString('_display_name'), javaString(name)]);
	java.invoke(values, 'put', [javaString('relative_path'), javaString(FOLDER)]);

	const collection = javaReference(
		java.getField(
			java.getClass('android.provider.MediaStore$Downloads'),
			'EXTERNAL_CONTENT_URI',
		),
	);
	const uri =
		resolver && collection
			? javaReference(java.invoke(resolver, 'insert', [collection, values]))
			: null;
	const stream = uri ? javaReference(java.invoke(resolver!, 'openOutputStream', [uri])) : null;

	if (!stream) throw new Error('Android gave no place to save the file');

	try {
		java.invoke(stream, 'write', [{ type: 'bytes', value: bytes }]);
	} finally {
		java.invoke(stream, 'close', []);
	}

	return `${FOLDER}/${name}`;
}
