import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { native, storage } from '@unbound-app/api';

import { roundAndroidAvatars as android } from '~/native/hooks-android';
import { roundIOSAvatars as ios } from '~/native/hooks-ios';

const roundAvatars = native.definePlatform({ ios, android });

let avatars: ReturnType<typeof roundAvatars> | undefined;

/**
 * @description Rounds every avatar to the chosen corner radius, and rounds them again when the radius changes.
 * Hooks Discord's native avatar views through the platform's native bridge (`DCDAvatarView` on iOS, `SimpleDraweeView`
 * on Android). The Addon scope removes the radius listener; `restoreAvatarCircles` removes the native hooks.
 * @param context The plugin's native bridge and capabilities.
 */
export function hookAvatarViews(context: PluginContext): void {
	if (!ensureCapabilities(context.native, context.capabilities)) return;

	const current = roundAvatars(context.native, () => settings.radius);

	storage.onChange(
		({ store, key }) => store === addon.id && key === 'radius',
		() => current.refresh(),
	);

	avatars = current;
}

/**
 * @description Brings the circles back on every avatar the plugin rounded.
 * @returns A promise that settles once the native hooks are removed.
 */
export async function restoreAvatarCircles(): Promise<void> {
	const current = avatars;

	avatars = undefined;
	await current?.dispose();
}

/**
 * @description Checks that avatars are rounded and none lost its corners.
 * @returns Whether the check passed, and what it counted.
 */
export async function selfTestAvatars() {
	if (!avatars) {
		return { ok: false, detail: 'avatars are not being rounded' };
	}

	const wrong = await avatars.unrounded();

	if (wrong) {
		return {
			ok: false,
			detail: `${wrong} avatars lost their ${settings.radius} point corners`,
		};
	}

	return {
		ok: true,
		detail: `${await avatars.rounded()} avatars rounded to ${settings.radius} points`,
	};
}
