import {
	javaInt,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaReference } from '@unbound-app/api/native';

import type { PdfViewer } from '~/native/viewer';

const FILE_PROVIDER = 'com.discord.file-provider';
const FILE_PROVIDER_CLASS = 'androidx.core.content.FileProvider';
const URI_FOR_FILE = ['android.content.Context', 'java.lang.String', 'java.io.File'];
const GRANT_READ_URI = 1;
const NEW_TASK = 0x10000000;

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

function contentUri(java: NativeBridge['java'], app: NativeJavaReference, path: string) {
	const method = uriForFileMethod(java);

	if (!method) throw new Error('no FileProvider.getUriForFile');

	const file = java.construct('java.io.File', [javaString(path)]);

	return javaReference(
		java.invoke(java.getClass(FILE_PROVIDER_CLASS), method, [
			app,
			javaString(FILE_PROVIDER),
			file,
		]),
	);
}

/**
 * @description Opens PDFs in the phone's PDF app, such as Google Drive's viewer, through Discord's file provider.
 * @param native The plugin's native bridge.
 * @returns The viewer, whose `open` throws when no app can show PDFs. Android 11's package visibility hides
 * PDF apps from `resolveActivity`, so it starts the activity and lets that fail instead.
 */
export function createViewer(native: NativeBridge): PdfViewer {
	const { java } = native;

	return {
		async open(path) {
			const app = javaReference(
				java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
			);

			if (!app) throw new Error('no application context');

			const uri = contentUri(java, app, path);

			if (!uri) throw new Error('no content link for the PDF');

			const intent = java.construct('android.content.Intent', [
				javaString('android.intent.action.VIEW'),
			]);

			java.invoke(intent, 'setDataAndType', [uri, javaString('application/pdf')]);
			java.invoke(intent, 'addFlags', [javaInt(NEW_TASK | GRANT_READ_URI)]);

			java.invoke(app, 'startActivity', [intent]);
		},
		dispose() {},
	};
}

export default { createViewer };
