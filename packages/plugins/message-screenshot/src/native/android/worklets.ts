import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
const OUTPUT_FILE = 'Unbound/cache/message-screenshot.png';
const MAX_VISITED = 4000;
const PNG_QUALITY = 100;

type Bounds = { left: number; top: number; right: number; bottom: number };

function child(java: NativeJavaBridge, view: NativeJavaReference, index: number) {
	'worklet';

	return javaReference(java.invoke(view, 'getChildAt', [javaInt(index)]));
}

function rowBounds(java: NativeJavaBridge, view: NativeJavaReference): Bounds | undefined {
	'worklet';
	const rect = java.construct('android.graphics.Rect', []);

	if (!javaFlag(java.invoke(view, 'getGlobalVisibleRect', [rect]))) return undefined;

	return {
		left: javaNumber(java.getField(rect, 'left')) ?? 0,
		top: javaNumber(java.getField(rect, 'top')) ?? 0,
		right: javaNumber(java.getField(rect, 'right')) ?? 0,
		bottom: javaNumber(java.getField(rect, 'bottom')) ?? 0,
	};
}

function findRows(
	java: NativeJavaBridge,
	decor: NativeJavaReference,
	ids: string[],
	idField: string,
): Bounds[] {
	'worklet';
	const ViewGroup = java.getClass('android.view.ViewGroup');
	const MessageView = java.getClass(MESSAGE_VIEW);
	const found: Bounds[] = [];
	const stack: NativeJavaReference[] = [decor];
	let visited = 0;

	while (stack.length && visited++ < MAX_VISITED) {
		const view = stack.pop()!;

		if (javaFlag(java.invoke(MessageView, 'isInstance', [view]))) {
			const id = javaText(java.getField(view, idField));
			const bounds = id && ids.includes(id) ? rowBounds(java, view) : undefined;

			if (bounds) found.push(bounds);

			continue;
		}

		if (!javaFlag(java.invoke(ViewGroup, 'isInstance', [view]))) continue;

		const count = javaNumber(java.invoke(view, 'getChildCount', [])) ?? 0;

		for (let index = 0; index < count; index++) {
			const next = child(java, view, index);

			if (next) stack.push(next);
		}
	}

	return found;
}

function union(rows: Bounds[], width: number, height: number): Bounds | undefined {
	'worklet';

	if (!rows.length) return undefined;

	const bounds = {
		left: Math.max(0, Math.min(...rows.map((row) => row.left))),
		top: Math.max(0, Math.min(...rows.map((row) => row.top))),
		right: Math.min(width, Math.max(...rows.map((row) => row.right))),
		bottom: Math.min(height, Math.max(...rows.map((row) => row.bottom))),
	};

	return bounds.right > bounds.left && bounds.bottom > bounds.top ? bounds : undefined;
}

function writePng(java: NativeJavaBridge, bitmap: NativeJavaReference, app: NativeJavaReference) {
	'worklet';
	const files = javaReference(java.invoke(app, 'getFilesDir', []));
	const file = java.construct('java.io.File', [files!, javaString(OUTPUT_FILE)]);
	const parent = javaReference(java.invoke(file, 'getParentFile', []));

	if (parent) java.invoke(parent, 'mkdirs', []);

	const stream = java.construct('java.io.FileOutputStream', [file]);
	const PNG = java.getField(java.getClass('android.graphics.Bitmap$CompressFormat'), 'PNG');

	try {
		java.invoke(bitmap, 'compress', [javaReference(PNG)!, javaInt(PNG_QUALITY), stream]);
	} finally {
		java.invoke(stream, 'close', []);
		java.invoke(bitmap, 'recycle', []);
	}

	return javaText(java.invoke(file, 'getAbsolutePath', [])) ?? '';
}

/**
 * @description Copies the pixels of the given messages' rows off the screen with `PixelCopy`, which also reads
 * hardware-backed images such as avatars, and saves them as a PNG in Discord's shared files folder.
 * @param scope The plugin's UI scope.
 * @param ids The messages to include.
 * @param idField The `MessageView` field holding its message id.
 * @param done Called with the PNG's path, `not-visible` when no row is on screen, or an empty string on failure.
 */
export function captureRows(
	scope: NativeUIScope,
	ids: string[],
	idField: string,
	done: NativeUICallback<[string]>,
) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	try {
		const app = javaReference(
			java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
		);
		const tracker = javaReference(
			java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
		);
		const activity = tracker
			? javaReference(java.invoke(tracker, 'currentActivity', []))
			: null;
		const window = activity ? javaReference(java.invoke(activity, 'getWindow', [])) : null;
		const decor = window ? javaReference(java.invoke(window, 'getDecorView', [])) : null;

		if (!app || !window || !decor) {
			done('');

			return;
		}

		const width = javaNumber(java.invoke(decor, 'getWidth', [])) ?? 0;
		const height = javaNumber(java.invoke(decor, 'getHeight', [])) ?? 0;
		const region = union(findRows(java, decor, ids, idField), width, height);

		if (!region) {
			done('not-visible');

			return;
		}

		const config = java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888');
		const bitmap = javaReference(
			java.invoke(java.getClass('android.graphics.Bitmap'), 'createBitmap', [
				javaInt(region.right - region.left),
				javaInt(region.bottom - region.top),
				javaReference(config)!,
			]),
		);
		const source = java.construct('android.graphics.Rect', [
			javaInt(region.left),
			javaInt(region.top),
			javaInt(region.right),
			javaInt(region.bottom),
		]);
		const looper = javaReference(
			java.invoke(java.getClass('android.os.Looper'), 'getMainLooper', []),
		);
		const handler = java.construct('android.os.Handler', [looper!]);
		const listener = hooks.proxy(
			['android.view.PixelCopy$OnPixelCopyFinishedListener'],
			(call) => {
				try {
					done(
						javaNumber(call.args[0]) === 0 && bitmap ? writePng(java, bitmap, app) : '',
					);
				} catch (error) {
					console.error(
						`[Message Screenshot] Failed to save the screenshot: ${String(error)}`,
					);
					done('');
				}
			},
		);

		java.invoke(java.getClass('android.view.PixelCopy'), 'request', [
			window,
			source,
			bitmap!,
			listener.object,
			handler,
		]);
	} catch (error) {
		console.error(`[Message Screenshot] Failed to capture messages: ${String(error)}`);
		done('');
	}
}

export default { captureRows };
