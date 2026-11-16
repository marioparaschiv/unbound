import { messageIdField } from '@unbound-plugins/shared/native/android/discord-views';
import {
	javaInt,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaReference } from '@unbound-app/api/native';

import type { ScreenshotOutput, ScreenshotResult } from '~/native/screenshot';
import { captureRows } from '~/native/android/worklets';

const FILE_PROVIDER = 'com.discord.file-provider';
const FILE_PROVIDER_CLASS = 'androidx.core.content.FileProvider';
const URI_FOR_FILE = ['android.content.Context', 'java.lang.String', 'java.io.File'];
const GRANT_READ_URI = 1;
const NEW_TASK = 0x10000000;
const CAPTURE_TIMEOUT_MS = 5000;

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

function capture(native: NativeBridge, ids: string[]): Promise<string> {
	const scope = native.ui.createScope();

	return new Promise<string>((resolve) => {
		const timer = setTimeout(() => resolve(''), CAPTURE_TIMEOUT_MS);
		const done = native.ui.callback((path: string) => {
			clearTimeout(timer);
			resolve(path);
		});

		native.ui.run(captureRows, scope, ids, messageIdField(native.java), done);
	}).finally(() => scope.dispose());
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

function share(java: NativeBridge['java'], app: NativeJavaReference, uri: NativeJavaReference) {
	const intent = java.construct('android.content.Intent', [
		javaString('android.intent.action.SEND'),
	]);

	java.invoke(intent, 'setType', [javaString('image/png')]);
	java.invoke(intent, 'putExtra', [javaString('android.intent.extra.STREAM'), uri]);
	java.invoke(intent, 'addFlags', [javaInt(GRANT_READ_URI)]);

	const chooser = javaReference(
		java.invoke(java.getClass('android.content.Intent'), 'createChooser', [
			intent,
			javaString(''),
		]),
	);

	if (!chooser) throw new Error('no share chooser');

	java.invoke(chooser, 'addFlags', [javaInt(NEW_TASK | GRANT_READ_URI)]);
	java.invoke(app, 'startActivity', [chooser]);
}

function copy(java: NativeBridge['java'], app: NativeJavaReference, uri: NativeJavaReference) {
	const resolver = javaReference(java.invoke(app, 'getContentResolver', []));
	const clipboard = javaReference(
		java.invoke(app, 'getSystemService', [javaString('clipboard')]),
	);

	if (!resolver || !clipboard) throw new Error('no resolver or clipboard');

	const clip = java.invoke(java.getClass('android.content.ClipData'), 'newUri', [
		resolver,
		javaString('image'),
		uri,
	]);

	java.invoke(clipboard, 'setPrimaryClip', [javaReference(clip)!]);
}

/**
 * @description Captures the rows of the given messages as Discord draws them on Android, then shares or copies the
 * picture through Discord's own file provider.
 * @param native The plugin's native bridge.
 * @param ids The messages to include.
 * @param output Whether to open the share sheet or copy the picture.
 * @returns `not-visible` when none of the rows is on screen.
 */
export async function screenshotAndroid(
	native: NativeBridge,
	ids: string[],
	output: ScreenshotOutput,
): Promise<ScreenshotResult> {
	const { java } = native;
	const path = await capture(native, ids);

	if (path === 'not-visible') return 'not-visible';

	if (!path) throw new Error('capturing the rows failed');

	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);
	const uri = app ? contentUri(java, app, path) : null;

	if (!app || !uri) throw new Error('no content URI for the screenshot');

	if (output === 'copy') copy(java, app, uri);
	else share(java, app, uri);

	return 'done';
}

export default screenshotAndroid;
