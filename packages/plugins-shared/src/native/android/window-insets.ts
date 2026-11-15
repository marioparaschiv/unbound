import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import { javaInt, javaNumber, javaReference } from './java-values';

/** How far the status bar, navigation bar and display cutout reach into a window from each side, in pixels. */
export type WindowInsetsPx = { left: number; top: number; right: number; bottom: number };

const NONE: WindowInsetsPx = { left: 0, top: 0, right: 0, bottom: 0 };

type InsetsJava = Pick<NativeJavaBridge, 'getClass' | 'invoke' | 'invokeAsync' | 'getField'>;

function sideOf(java: InsetsJava, insets: NativeJavaReference, side: keyof WindowInsetsPx) {
	return javaNumber(java.getField(insets, side)) ?? 0;
}

async function legacyInsets(java: InsetsJava, root: NativeJavaReference): Promise<WindowInsetsPx> {
	const read = async (getter: string) =>
		javaNumber(await java.invokeAsync(root, getter, [])) ?? 0;

	return {
		left: await read('getSystemWindowInsetLeft'),
		top: await read('getSystemWindowInsetTop'),
		right: await read('getSystemWindowInsetRight'),
		bottom: await read('getSystemWindowInsetBottom'),
	};
}

/**
 * @description Reads how far the system bars and display cutout cover a view's window, which an overlay on an edge-to-edge screen must stay clear of (Android 15 and later draw every app edge to edge).
 * @param java The plugin's Java bridge.
 * @param view Any attached view in the window, such as the decor view.
 * @returns The insets in pixels, or zeros while the view is detached.
 */
export async function systemBarInsets(
	java: InsetsJava,
	view: NativeJavaReference,
): Promise<WindowInsetsPx> {
	const root = javaReference(await java.invokeAsync(view, 'getRootWindowInsets', []));

	if (!root) return NONE;

	const Type = java.getClass('android.view.WindowInsets$Type');

	// WindowInsets.Type arrived in Android 11; older versions only report the system window insets.
	if (!Type) return legacyInsets(java, root);

	const bars = javaNumber(java.invoke(Type, 'systemBars', [])) ?? 0;
	const cutout = javaNumber(java.invoke(Type, 'displayCutout', [])) ?? 0;
	const insets = javaReference(
		await java.invokeAsync(root, 'getInsets', [javaInt(bars | cutout)]),
	);

	if (!insets) return NONE;

	return {
		left: sideOf(java, insets, 'left'),
		top: sideOf(java, insets, 'top'),
		right: sideOf(java, insets, 'right'),
		bottom: sideOf(java, insets, 'bottom'),
	};
}

/**
 * @description Shrinks a frame by insets, such as a window's bounds by its system bars.
 * @param frame The frame, in the insets' units.
 * @param insets The insets.
 * @returns The frame inside the insets.
 */
export function insetFrame<T extends { x: number; y: number; width: number; height: number }>(
	frame: T,
	insets: WindowInsetsPx,
): T {
	return {
		...frame,
		x: frame.x + insets.left,
		y: frame.y + insets.top,
		width: Math.max(0, frame.width - insets.left - insets.right),
		height: Math.max(0, frame.height - insets.top - insets.bottom),
	};
}
