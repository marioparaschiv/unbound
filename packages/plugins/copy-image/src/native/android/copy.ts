import {
	javaInt,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge } from '@unbound-app/api/native';

const FILE_PROVIDER = 'com.discord.file-provider';
const FILE_PROVIDER_CLASS = 'androidx.core.content.FileProvider';
const URI_FOR_FILE = ['android.content.Context', 'java.lang.String', 'java.io.File'];

// Discord shrinks the provider's method names, so its getUriForFile is found by shape.
function uriForFileMethod(java: NativeBridge['java']): string | undefined {
	return java
		.describe(FILE_PROVIDER_CLASS)
		.methods.find(
			(method) =>
				method.static &&
				method.returnType === 'android.net.Uri' &&
				method.parameters.join() === URI_FOR_FILE.join(),
		)?.name;
}
// Discord's file provider shares its whole files folder; its cache folder only for notification images.
const FILE_PATH = 'Unbound/cache/copied-image.png';
const BASE64_DEFAULT = 0;
// The bridge caps each string argument at 4 KB, so the image crosses in pieces; a multiple of 4 keeps each piece decodable alone.
const CHUNK_CHARACTERS = 4000;

/**
 * @description Puts a PNG on the Android clipboard: writes it to Unbound's cache folder and copies a content URI from Discord's
 * own file provider, since Android's clipboard holds images only by URI.
 * @param native The plugin's native bridge.
 * @param base64 The PNG's bytes, as base64.
 * @returns Whether the image was copied; it throws naming the step that failed.
 */
export async function copyOnAndroid({ java }: NativeBridge, base64: string): Promise<boolean> {
	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);

	if (!app) throw new Error('no application context');

	const files = javaReference(java.invoke(app, 'getFilesDir', []));

	if (!files) throw new Error('no files directory');

	const Base64 = java.getClass('android.util.Base64');
	const file = java.construct('java.io.File', [files, javaString(FILE_PATH)]);

	java.invoke(javaReference(java.invoke(file, 'getParentFile', []))!, 'mkdirs', []);
	const stream = java.construct('java.io.FileOutputStream', [file]);

	try {
		for (let offset = 0; offset < base64.length; offset += CHUNK_CHARACTERS) {
			const piece = base64.slice(offset, offset + CHUNK_CHARACTERS);
			const bytes = javaReference(
				java.invoke(Base64, 'decode', [javaString(piece), javaInt(BASE64_DEFAULT)]),
			);

			if (!bytes) throw new Error(`no decoded bytes at ${offset}`);

			java.invoke(stream, 'write', [bytes]);
		}
	} finally {
		java.invoke(stream, 'close', []);
	}

	const method = uriForFileMethod(java);

	if (!method) throw new Error('no FileProvider.getUriForFile');

	const uri = javaReference(
		java.invoke(java.getClass(FILE_PROVIDER_CLASS), method, [
			app,
			javaString(FILE_PROVIDER),
			file,
		]),
	);
	const resolver = javaReference(java.invoke(app, 'getContentResolver', []));
	const clipboard = javaReference(
		java.invoke(app, 'getSystemService', [javaString('clipboard')]),
	);

	if (!uri || !resolver || !clipboard) throw new Error('no content URI, resolver or clipboard');

	const clip = java.invoke(java.getClass('android.content.ClipData'), 'newUri', [
		resolver,
		javaString('image'),
		uri,
	]);

	java.invoke(clipboard, 'setPrimaryClip', [javaReference(clip)!]);

	return true;
}

export default copyOnAndroid;
