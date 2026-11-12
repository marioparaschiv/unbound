import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';
import type { PluginSelfTestResult } from '@unbound-app/api/global';
import { native } from '@unbound-app/api';

import { drawAndroidBubbles as android } from '~/native/android/views';
import { drawIOSBubbles as ios } from '~/native/ios/views';
import { watchAppearance } from '~/lib/theme';

const drawPlatformBubbles = native.definePlatform({ ios, android });

let bubbles: ReturnType<typeof drawPlatformBubbles> | null = null;

/**
 * @description Draws a rounded bubble behind each message, hooking the native message views of each platform.
 * Depends on the Theme, Message, User and SelectedChannel stores.
 * @param context The plugin's native bridge and granted capabilities.
 */
export function drawBubbles(context: PluginContext): void {
	if (!ensureCapabilities(context.native, context.capabilities)) return;

	bubbles = drawPlatformBubbles(context.native);
}

/**
 * @description Repaints the bubbles when the theme or a bubble setting changes, while they are drawn.
 */
export function listenToAppearance(): void {
	watchAppearance(() => bubbles?.refresh());
}

/**
 * @description Removes the native bubbles, which the scope cannot see; the appearance listener stops repainting first.
 * @returns A promise that settles once the native views are restored.
 */
export async function removeBubbles(): Promise<void> {
	const drawn = bubbles;

	bubbles = null;

	await drawn?.dispose();
}

/**
 * @description Checks that bubbles are on screen and drawn correctly, for the device matrix.
 * @returns `ok`, with how many bubbles are placed, or the first problems found.
 */
export async function bubblesSelfTest(): Promise<PluginSelfTestResult> {
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
