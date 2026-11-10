import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import { watchAppearance } from '~/bubbles/theme';
import { drawBubbles } from '~/bubbles/platform';

type Bubbles = ReturnType<typeof drawBubbles>;

let bubbles: Bubbles | null = null;

/**
 * @description Draws a rounded bubble behind each message, and repaints them when the theme or a bubble setting changes.
 * Hooks the native message views of each platform, and depends on the Theme, Message, User and SelectedChannel stores.
 * @param context The plugin's native bridge and granted capabilities.
 * @returns A function that stops the appearance listeners first, then removes the native bubbles, which the scope
 * cannot see; it settles once the native views are restored.
 */
export function startBubbles(context: PluginContext): (() => Promise<void>) | undefined {
	if (!ensureCapabilities(context.native, context.capabilities)) return;

	const drawn = drawBubbles(context.native);
	const unwatch = watchAppearance(() => drawn.refresh());

	bubbles = drawn;

	return async () => {
		unwatch();
		bubbles = null;

		await drawn.dispose();
	};
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
