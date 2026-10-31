import type { NativeObjectHandle, NativePluginBridge } from '@unbound-app/api/native';

/**
 * @description Sets the rotation of the root view of Discord's key window, through its layer's
 * `transform.rotation.z`. UIKit hit-tests through view transforms, so scrolling and taps follow the
 * finger on the rotated screen.
 * @param native The plugin's native bridge.
 * @param degrees The rotation, 180 for upside down and 0 to restore it.
 * @returns Whether a root view was found and rotated.
 */
export async function rotateScreen(
	{ objc }: NativePluginBridge,
	degrees: number,
): Promise<boolean> {
	const UIApplication = objc.getClass('UIApplication');

	if (!UIApplication) return false;

	const [, keyWindow] = await objc.batch([
		{ target: UIApplication, selector: 'sharedApplication', args: [] },
		{ target: { $nativeBatchResult: 0 }, selector: 'keyWindow', args: [] },
	]);

	if (!keyWindow) return false;

	const [, rootView, layer] = await objc.batch([
		{ target: keyWindow as NativeObjectHandle, selector: 'rootViewController', args: [] },
		{ target: { $nativeBatchResult: 0 }, selector: 'view', args: [] },
		{ target: { $nativeBatchResult: 1 }, selector: 'layer', args: [] },
	]);

	if (!rootView || !layer) return false;

	await objc.invokeAsync(layer as NativeObjectHandle, 'setValue:forKeyPath:', [
		(degrees * Math.PI) / 180,
		'transform.rotation.z',
	]);

	return true;
}
