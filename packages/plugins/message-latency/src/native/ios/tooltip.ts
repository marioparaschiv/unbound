import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { createIOSTooltips } from '@unbound-plugins/shared/tooltips/ios-tooltips';
import { parseRect, toRect } from '@unbound-plugins/shared/native/ios/rect';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';

import { Icon } from '~/lib/constants';

export type TooltipAnchor = {
	cellKey: string;
	icon: NativeObjectHandle;
	tooltip: string;
};

export type TooltipController = {
	/** Shows the anchor's tooltip, replacing any open one. `isCurrent` reports whether the anchor is still on screen. */
	show(anchor: TooltipAnchor, isCurrent: () => boolean): void;
	dismissFor(cellKey: string): void;
	dispose(): Promise<void>;
};

/**
 * @description Creates the tooltip shown when an indicator is tapped. It closes on the next touch or after a few seconds.
 * @param native The `context.native` bridge: its Objective-C bridge, and Fabric bridge to mount Discord's tooltip.
 * @returns The tooltip controller.
 */
export function createTooltips(native: Pick<NativeBridge, 'objc' | 'fabric'>): TooltipController {
	const { objc } = native;
	const tooltips = createIOSTooltips(native, 'MessageLatencyTooltipSurface');

	return {
		show: ({ cellKey, icon, tooltip }, isCurrent) =>
			tooltips.show(
				{
					key: cellKey,
					text: tooltip,
					window: async () =>
						(await safeInvokeAsync(objc, icon, 'window')) as NativeObjectHandle | null,
					// The visible bars sit 4pt below the top of the taller tap target.
					frame: async (window) =>
						parseRect(
							await safeInvokeAsync(
								objc,
								icon,
								'convertRect:toView:',
								toRect(objc, {
									x: 0,
									y: 4,
									width: Icon.width,
									height: Icon.height,
								}),
								window,
							),
						) ?? null,
				},
				isCurrent,
			),
		dismissFor: (cellKey) => tooltips.dismissFor(cellKey),
		dispose: () => tooltips.dispose(),
	};
}

export default { createTooltips };
