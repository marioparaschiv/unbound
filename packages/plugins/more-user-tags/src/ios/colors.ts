import { parseNativeColorDescription } from '@unbound-plugins/shared/colors/role-colors';
import type {
	NativeClassHandle,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/api/native';

import { HEX_COLOR } from '~/constants';

export type NativeColors = ReturnType<typeof createNativeColors>;

/**
 * @description UIKit color helpers for the gradient renderer.
 * @param objc The Objective-C bridge.
 * @param UIColor The `UIColor` class.
 * @param NSArray The `NSArray` class.
 * @returns `clear` resolves to `UIColor.clearColor`, `cgColor` builds a CGColor, `isTransparent` tests a UIColor.
 */
export function createNativeColors(
	objc: NativeObjCBridge,
	UIColor: NativeClassHandle,
	NSArray: NativeClassHandle,
) {
	const clear = objc
		.invokeAsync(UIColor, 'clearColor', [])
		.catch(() => null) as Promise<NativeObjectHandle | null>;

	async function cgColor(hex: string, alpha: number = 1): Promise<NativeObjectHandle | null> {
		if (!HEX_COLOR.test(hex)) return null;

		const value = Number.parseInt(hex.slice(1), 16);
		const [red, green, blue] = [16, 8, 0].map((shift) => ((value >> shift) & 0xff) / 255);

		try {
			const color = (await objc.invokeAsync(UIColor, 'colorWithRed:green:blue:alpha:', [
				red,
				green,
				blue,
				alpha,
			])) as NativeObjectHandle | null;

			if (!color) return null;

			const pointer = await objc.invokeAsync(color, 'CGColor', []);

			if (!pointer) return null;

			// CGColor comes back as a raw pointer; a round trip through NSArray returns it as an object handle.
			const boxed = await objc.invokeAsync(NSArray, 'arrayWithObject:', [pointer]);

			if (!Array.isArray(boxed)) return null;

			const [handle] = boxed;

			return handle && typeof handle === 'object' ? (handle as NativeObjectHandle) : null;
		} catch {
			return null;
		}
	}

	async function isTransparent(color: NativeObjectHandle | null): Promise<boolean> {
		if (!color) return false;

		if (await objc.invokeAsync(color, 'isEqual:', [await clear])) return true;

		const description = await objc.invokeAsync(color, 'description', []);

		return (
			typeof description === 'string' && parseNativeColorDescription(description)?.alpha === 0
		);
	}

	return { clear, cgColor, isTransparent };
}

export default { createNativeColors };
