import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';
import { viewKey } from '@unbound-plugins/shared/native/view-key';
import { readRect } from '@unbound-plugins/shared/native/rect';

import type { IconMode } from '~/preferences';
import devicons from '~/devicons.json';

export type NativeUI = ReturnType<typeof createNativeUI>;

const deviconLanguages: Record<string, string> = devicons.languages;
const deviconImages: Record<string, string> = devicons.images;

/**
 * @description Wraps the Objective-C bridge with the UIKit helpers the renderer needs, caching colors, fonts and icons.
 * @param objc The plugin's scoped Objective-C bridge.
 * @returns Helpers that return `null` instead of throwing when a native call fails.
 */
export function createNativeUI(objc: NativeObjCBridge) {
	const colors = new Map<string, NativeObjectHandle>();
	const fonts = new Map<string, NativeObjectHandle>();
	const images = new Map<string, NativeObjectHandle>();

	// A call with a missing argument is skipped, so one unavailable color or font cannot crash UIKit.
	function call(handle: NativeObjectHandle, selector: string, ...args: unknown[]): unknown {
		if (args.some((argument) => argument === null || argument === undefined)) return null;

		return safeInvoke(objc, handle, selector, ...args);
	}

	function view(handle: NativeObjectHandle, selector: string, ...args: unknown[]) {
		return call(handle, selector, ...args) as NativeObjectHandle | null;
	}

	// UNKNOWN: selectors return either a bridged JS string or an NSString handle.
	function string(value: unknown): string | undefined {
		if (typeof value === 'string') return value;

		if (!value || typeof value !== 'object') return;

		const handle = value as NativeObjectHandle;

		if (!objc.respondsTo(handle, 'description')) return;

		const description = call(handle, 'description');

		return typeof description === 'string' ? description : undefined;
	}

	function key(handle: NativeObjectHandle): string {
		return viewKey(objc, handle) ?? 'unknown';
	}

	function rect(x: number, y: number, width: number, height: number) {
		return objc.struct('CGRect', { origin: { x, y }, size: { width, height } });
	}

	function size(width: number, height: number) {
		return objc.struct('CGSize', { width, height });
	}

	function range(location: number, length: number) {
		return objc.struct('NSRange', { location, length });
	}

	function frameOf(handle: NativeObjectHandle) {
		return readRect(call(handle, 'frame'));
	}

	function cached(
		cache: Map<string, NativeObjectHandle>,
		cacheKey: string,
		create: () => NativeObjectHandle | null,
	): NativeObjectHandle | null {
		const hit = cache.get(cacheKey);

		if (hit) return hit;

		let created: NativeObjectHandle | null = null;

		try {
			created = create();
		} catch {
			return null;
		}

		if (created) cache.set(cacheKey, created);

		return created;
	}

	function color(hex: string, alpha: number = 1): NativeObjectHandle | null {
		const rgb = hex.replace('#', '');

		if (!/^[\da-f]{6}$/i.test(rgb)) return null;

		return cached(colors, `${hex}:${alpha}`, () => {
			const UIColor = objc.getClass('UIColor');
			const [red, green, blue] = [0, 2, 4].map(
				(offset) => Number.parseInt(rgb.slice(offset, offset + 2), 16) / 255,
			);

			return UIColor
				? view(UIColor, 'colorWithRed:green:blue:alpha:', red, green, blue, alpha)
				: null;
		});
	}

	function font(
		pointSize: number,
		weight: number,
		monospaced: boolean,
	): NativeObjectHandle | null {
		return cached(fonts, `${pointSize}:${weight}:${monospaced}`, () => {
			const UIFont = objc.getClass('UIFont');
			const selector = monospaced
				? 'monospacedSystemFontOfSize:weight:'
				: 'systemFontOfSize:weight:';

			return UIFont ? view(UIFont, selector, pointSize, weight) : null;
		});
	}

	function devicon(language: string, mode: Exclude<IconMode, 'disabled'>) {
		const iconName = deviconLanguages[language];
		const png = iconName ? deviconImages[iconName] : null;

		if (!png) return null;

		return cached(images, `${iconName}:${mode}`, () => {
			const UIImage = objc.getClass('UIImage');
			const data = objc.data(
				Uint8Array.from(atob(png), (character) => character.charCodeAt(0)),
			);
			const image = UIImage ? view(UIImage, 'imageWithData:', data) : null;

			// Template rendering lets the header tint a greyscale icon with the theme's foreground.
			return image && mode === 'greyscale'
				? view(image, 'imageWithRenderingMode:', 2)
				: image;
		});
	}

	return { objc, call, view, string, key, rect, size, range, frameOf, color, font, devicon };
}

export default { createNativeUI };
