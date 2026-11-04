import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import { watchAppearance } from '~/bubbles/theme';
import { drawBubbles } from '~/bubbles/platform';
import { PLUGIN_NAME } from '~/constants';

type Bubbles = ReturnType<typeof drawBubbles>;

let bubbles: Bubbles | null = null;
let unwatch: (() => void) | null = null;

/**
 * @description Draws a rounded bubble behind each message, and repaints them when the theme or a bubble setting changes.
 * Hooks the native message views of each platform, and depends on the Theme, Message, User and SelectedChannel stores.
 * `stopBubbles` stops the appearance listeners first, then removes the native bubbles, which the scope cannot see.
 * @param context The plugin's native bridge and granted capabilities.
 */
export function startBubbles(context: PluginContext): void {
	if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return;

	const drawn = drawBubbles(context.native);

	bubbles = drawn;
	unwatch = watchAppearance(() => drawn.refresh());
}

/**
 * @description Removes every bubble the plugin drew.
 * @returns A promise that settles once the native views are restored.
 */
export async function stopBubbles(): Promise<void> {
	const drawn = bubbles;

	unwatch?.();
	unwatch = null;
	bubbles = null;

	await drawn?.dispose();
}

/**
 * @description Checks that bubbles are on screen and drawn correctly, for the device matrix.
 * @returns `ok`, with how many bubbles are placed, or the first problems found.
 */
export async function bubblesSelfTest() {
	if (!bubbles) {
		return { ok: false, detail: 'bubbles are not drawing' };
	}

	const found = await bubbles.problems();

	if (found.length) {
		return {
			ok: false,
			detail: `${found.length} bubbles look wrong: ${found.slice(0, 3).join('; ')}`,
		};
	}

	const count = bubbles.placed();

	return {
		ok: true,
		detail: `${count} bubbles placed on screen`,
		...(count ? {} : { nothingDrawn: true }),
		...(bubbles.settling() ? { settling: true } : {}),
	};
}
