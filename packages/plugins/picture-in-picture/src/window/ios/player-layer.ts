import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';
import type { NativeHandle, NativeObjCBridge } from '@unbound-app/api/native';

import { IOS_LAYER_DEPTH, IOS_PORTAL_VIEW, IOS_VIEW_SEARCH } from '~/constants';

// UNKNOWN: the bridge returns untyped values; only object handles are kept.
export function asHandle(value: unknown): NativeHandle | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as NativeHandle)
		: null;
}

// UNKNOWN: `sublayers` comes back as an untyped array.
function asHandles(value: unknown): NativeHandle[] {
	if (!Array.isArray(value)) return [];

	return value.map(asHandle).filter((handle): handle is NativeHandle => handle !== null);
}

async function keyWindow(objc: NativeObjCBridge): Promise<NativeHandle | null> {
	const UIApplication = objc.getClass('UIApplication');

	if (!UIApplication) return null;

	const app = asHandle(await safeInvokeAsync(objc, UIApplication, 'sharedApplication'));

	return app ? asHandle(await safeInvokeAsync(objc, app, 'keyWindow')) : null;
}

async function findPlayerLayer(
	objc: NativeObjCBridge,
	root: NativeHandle,
	playerLayerClass: NativeHandle,
): Promise<NativeHandle | null> {
	let level = [root];

	for (let depth = 0; depth <= IOS_LAYER_DEPTH && level.length > 0; depth += 1) {
		for (const layer of level) {
			if ((await safeInvokeAsync(objc, layer, 'isKindOfClass:', playerLayerClass)) === true) {
				return layer;
			}
		}

		const next: NativeHandle[] = [];

		for (const layer of level) {
			next.push(...asHandles(await safeInvokeAsync(objc, layer, 'sublayers')));
		}

		level = next;
	}

	return null;
}

/**
 * @description Finds the `AVPlayerLayer` of the video the media viewer shows. Discord plays it in its native `DCDMediaView`, which the viewer borrows from the chat through a `DCDPortalView`, so only the portal is searched and videos left in the chat are never picked.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns The player layer, or `null` when the key window shows no native video.
 */
export async function findViewerPlayerLayer(objc: NativeObjCBridge): Promise<NativeHandle | null> {
	const playerLayerClass = objc.getClass('AVPlayerLayer');
	const window = await keyWindow(objc);

	if (!playerLayerClass || !window) return null;

	const portals = await objc.findViews(window, IOS_PORTAL_VIEW, IOS_VIEW_SEARCH).catch(() => []);

	for (const portal of asHandles(portals)) {
		const layer = asHandle(await safeInvokeAsync(objc, portal, 'layer'));
		const found = layer && (await findPlayerLayer(objc, layer, playerLayerClass));

		if (found) return found;
	}

	return null;
}
