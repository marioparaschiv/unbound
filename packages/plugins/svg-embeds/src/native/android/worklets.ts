import type { NativeJavaBridge, NativeJavaReference, NativeUIScope } from '@unbound-app/api/native';
import {
	javaBoolean,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';

const STATE_KEY = '__unboundSvgEmbedsRenderers';
const SOFTWARE_LAYER = 1;
const EXACTLY = 1 << 30;
const TRANSPARENT = 0;
const PNG_QUALITY = 100;

type Renderers = Map<string, NativeJavaReference>;

function renderers(): Renderers {
	'worklet';
	const holder = globalThis as unknown as Record<typeof STATE_KEY, Renderers | undefined>;

	return (holder[STATE_KEY] ??= new Map());
}

function page(svgPath: string): string {
	'worklet';

	return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:transparent"><img src="file://${encodeURI(svgPath)}" style="display:block;width:100vw;height:100vh"></body></html>`;
}

/**
 * @description Starts loading an SVG file into an off-screen web view of the given pixel size, on the UI thread.
 * @param scope The plugin's UI scope.
 * @param id A name for this render, which the later calls use.
 * @param svgPath The SVG file's absolute path.
 * @param width The picture's width in pixels.
 * @param height The picture's height in pixels.
 * @returns Whether the web view was made.
 */
export function startSvgRender(
	scope: NativeUIScope,
	id: string,
	svgPath: string,
	width: number,
	height: number,
): boolean {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);

	if (!app) return false;

	const view = java.construct('android.webkit.WebView', [app]);
	const settings = javaReference(java.invoke(view, 'getSettings', []));

	if (settings) {
		java.invoke(settings, 'setAllowFileAccess', [javaBoolean(true)]);
		java.invoke(settings, 'setJavaScriptEnabled', [javaBoolean(false)]);
	}

	java.invoke(view, 'setLayerType', [
		javaInt(SOFTWARE_LAYER),
		{ type: 'null', class: 'android.graphics.Paint' },
	]);
	java.invoke(view, 'setBackgroundColor', [javaInt(TRANSPARENT)]);
	java.invoke(view, 'measure', [javaInt(width | EXACTLY), javaInt(height | EXACTLY)]);
	java.invoke(view, 'layout', [javaInt(0), javaInt(0), javaInt(width), javaInt(height)]);
	java.invoke(view, 'loadDataWithBaseURL', [
		javaString('file:///'),
		javaString(page(svgPath)),
		javaString('text/html'),
		javaString('utf-8'),
		{ type: 'null', class: 'java.lang.String' },
	]);
	renderers().set(id, view);

	return true;
}

/**
 * @description Reports how far a render's page has loaded, from 0 to 100, or -1 for an unknown render.
 * @param scope The plugin's UI scope.
 * @param id The render's name.
 * @returns The progress.
 */
export function svgRenderProgress(scope: NativeUIScope, id: string): number {
	'worklet';
	const view = renderers().get(id);

	return view
		? (javaNumber((scope.java as NativeJavaBridge).invoke(view, 'getProgress', [])) ?? 0)
		: -1;
}

/**
 * @description Draws a loaded render into a PNG file and frees its web view; with no PNG path it only frees it.
 * @param scope The plugin's UI scope.
 * @param id The render's name.
 * @param width The picture's width in pixels.
 * @param height The picture's height in pixels.
 * @param pngPath The PNG file's absolute path, or `null` to give up on the render.
 * @returns Whether the PNG was written.
 */
export function finishSvgRender(
	scope: NativeUIScope,
	id: string,
	width: number,
	height: number,
	pngPath: string | null,
): boolean {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const view = renderers().get(id);

	renderers().delete(id);

	if (!view) return false;

	try {
		if (!pngPath) return false;

		const config = java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888');
		const bitmap = javaReference(
			java.invoke(java.getClass('android.graphics.Bitmap'), 'createBitmap', [
				javaInt(width),
				javaInt(height),
				config,
			]),
		);

		if (!bitmap) return false;

		java.invoke(view, 'draw', [java.construct('android.graphics.Canvas', [bitmap])]);

		const format = java.getField(
			java.getClass('android.graphics.Bitmap$CompressFormat'),
			'PNG',
		);
		const stream = java.construct('java.io.FileOutputStream', [javaString(pngPath)]);

		try {
			java.invoke(bitmap, 'compress', [format, javaInt(PNG_QUALITY), stream]);
		} finally {
			java.invoke(stream, 'close', []);
			java.invoke(bitmap, 'recycle', []);
		}

		return true;
	} finally {
		java.invoke(view, 'destroy', []);
	}
}
