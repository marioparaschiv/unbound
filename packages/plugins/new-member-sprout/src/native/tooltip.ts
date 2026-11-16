import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createTooltip as android } from '~/native/android/tooltip';
import { createTooltip as ios } from '~/native/ios/tooltip';

/** Where a touch landed on screen, in window points. */
export type TouchPoint = { x: number; y: number };

/** The tooltip a tapped sprout opens; `dispose` closes it, which the Addon scope cannot do for native views. */
export type SproutTooltip = {
	/** Opens at `point`, or where the last touch landed when JS saw none. */
	show(point: TouchPoint | undefined, text: string): void;
	dispose(): Promise<void>;
};

const createPlatformTooltip = native.definePlatform({ ios, android });

/**
 * @description Creates the tooltip for this platform, like the one Message Latency opens.
 * @param context The plugin's native bridge.
 * @returns The tooltip, or `undefined` when the platform has none.
 */
export function createSproutTooltip(context: PluginContext): SproutTooltip | undefined {
	return createPlatformTooltip(context) ?? undefined;
}

export default { createSproutTooltip };
