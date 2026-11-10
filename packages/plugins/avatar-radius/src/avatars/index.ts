import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

import { roundAvatars } from '~/avatars/platform';

let rounded: (() => number | Promise<number>) | null = null;
let unrounded: (() => Promise<number>) | null = null;

/**
 * @description Rounds every avatar to the chosen corner radius, and rounds them again when the radius changes.
 * Hooks Discord's native avatar views through the platform's native bridge (`DCDAvatarView` on iOS, `SimpleDraweeView` on Android).
 * The Addon scope removes the radius listener, but the native hooks need the returned function.
 * @param context The plugin's native bridge and capabilities.
 * @returns A function that brings the circles back on every avatar the plugin rounded, settling once the native hooks are removed.
 */
export function startAvatars(context: PluginContext): (() => void | Promise<void>) | undefined {
	if (!ensureCapabilities(context.native, context.capabilities)) return;

	const avatars = roundAvatars(context.native, () => settings.radius);

	storage.onChange(
		({ store, key }) => store === addon.id && key === 'radius',
		() => avatars.refresh(),
	);

	rounded = avatars.rounded;
	unrounded = avatars.unrounded;

	return () => {
		rounded = null;
		unrounded = null;

		return avatars.dispose();
	};
}

/**
 * @description Checks that avatars are rounded and none lost its corners.
 * @returns Whether the check passed, and what it counted.
 */
export async function selfTestAvatars() {
	if (!rounded) {
		return { ok: false, detail: 'avatars are not being rounded' };
	}

	const wrong = (await unrounded?.()) ?? 0;

	if (wrong) {
		return {
			ok: false,
			detail: `${wrong} avatars lost their ${settings.radius} point corners`,
		};
	}

	return { ok: true, detail: `${await rounded()} avatars rounded to ${settings.radius} points` };
}
