import type {
	NativeFabricBridge,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import { createAndroidTooltips as createTooltips } from '@unbound-plugins/shared/tooltips/android-tooltips';
import { javaNumber } from '@unbound-plugins/shared/native/android/java-values';

import { Icon } from '~/lib/constants';

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

export type AndroidTooltipAnchor = {
	key: string;
	host: NativeJavaReference;
	tooltip: string;
};

export type AndroidTooltips = {
	show(anchor: AndroidTooltipAnchor): void;
	dismissFor(key: string): void;
	dispose(): Promise<void>;
};

/**
 * @description Creates the tooltip shown when an Android indicator is tapped, Discord's tooltip on its own surface over the window. It closes on the next touch or after a few seconds, like the iOS one.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @returns The tooltip controller.
 */
export function createAndroidTooltips(native: Native): AndroidTooltips {
	const { java } = native;
	const tooltips = createTooltips(native, 'MessageLatencyTooltipSurface');

	async function iconFrame(host: NativeJavaReference, density: number) {
		const rect = java.construct('android.graphics.Rect', []);

		await java.invokeAsync(host, 'getGlobalVisibleRect', [rect]);

		return {
			x: (javaNumber(java.getField(rect, 'left')) ?? 0) / density,
			y: (javaNumber(java.getField(rect, 'top')) ?? 0) / density + 4,
			width: Icon.width,
			height: Icon.height,
		};
	}

	return {
		show: ({ key, host, tooltip }) =>
			tooltips.show({ key, text: tooltip, frame: (density) => iconFrame(host, density) }),
		dismissFor: (key) => tooltips.dismissFor(key),
		dispose: () => tooltips.dispose(),
	};
}

export default { createAndroidTooltips };
