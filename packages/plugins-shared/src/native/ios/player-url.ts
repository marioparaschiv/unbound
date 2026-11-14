import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

/**
 * @description Reads the URL an `AVPlayer` plays, from its current item's `AVURLAsset`. Runs on the UI thread.
 * @param objc The Objective-C bridge of a UI scope.
 * @param player The `AVPlayer`.
 * @returns The URL, or an empty string when the player has no URL asset.
 */
export function playerURL(objc: NativeObjCBridge, player: NativeObjectHandle): string {
	'worklet';
	const item = objc.invoke(player, 'currentItem', []) as NativeObjectHandle | null;
	const asset = item && (objc.invoke(item, 'asset', []) as NativeObjectHandle | null);

	if (!asset || objc.className(asset) !== 'AVURLAsset') return '';

	const url = objc.invoke(asset, 'URL', []) as NativeObjectHandle | null;

	return url ? String(objc.invoke(url, 'absoluteString', [])) : '';
}

export default playerURL;
