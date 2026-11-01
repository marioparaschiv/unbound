import {
	javaFloat,
	javaInt,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import { currentDecorView } from '@unbound-plugins/shared/native/android/views';
import type { NativePluginBridge } from '@unbound-app/api/native';

/**
 * @description Sets the rotation of the content inside the decor view of Discord's current activity.
 * The decor view's child is rotated rather than the decor view itself, because Android maps a touch
 * through a view's rotation only in its parent, and the decor view has none. So scrolling and taps
 * follow the finger on the rotated screen.
 * @param native The plugin's native bridge.
 * @param degrees The rotation, 180 for upside down and 0 to restore it.
 * @returns Whether the content view was found and rotated.
 */
export async function rotateScreen(
	{ java }: NativePluginBridge,
	degrees: number,
): Promise<boolean> {
	const decorView = currentDecorView(java);
	const content = decorView
		? javaReference(await java.invokeAsync(decorView, 'getChildAt', [javaInt(0)]))
		: null;

	if (!content) return false;

	await java.invokeAsync(content, 'setRotation', [javaFloat(degrees)]);

	return true;
}
