import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import {
	hookReactions as hookAndroid,
	unhookReactions as unhookAndroid,
} from '~/native/android/hooks';
import { hookReactions as hookIos, unhookReactions as unhookIos } from '~/native/ios/hooks';
import ReactionAvatarSurface from '~/components/reaction-avatar-surface';
import { ReactionActions } from '~/lib/modules';

const hookPlatform = native.definePlatform({ ios: hookIos, android: hookAndroid });

/**
 * @description Removes the platform's native reaction hooks and the avatars they drew, which the Addon scope cannot see.
 */
export const unhookReactions = native.definePlatform({ ios: unhookIos, android: unhookAndroid });

/**
 * @description Draws the first reactors' avatars beside each message reaction.
 * Reads `ReactionActionCreators` to fetch reactors, and `UserSummaryItem`, found when a reaction first renders, to draw
 * the faces. Reads `ChannelStore`, `MessageStore`, `SelectedChannelStore` and `UserStore`. iOS hooks Discord's native message cells
 * and Android hooks its reaction views, so each platform's hooks are native and need `stop` to remove them.
 * @param context The plugin's context, whose native bridge hooks the message views.
 */
export function hookReactions(context: PluginContext): void {
	if (!ensureCapabilities(context.native, context.capabilities, 'Reaction avatars')) return;

	// `UserSummaryItem` is found when a reaction first renders, and the surface renders nothing without it.
	if (!ReactionActions) {
		logger.warn('Reaction avatars skipped: Discord moved ReactionActionCreators.');

		return;
	}

	const surfaceName = registerAppSurface('ReactionAvatarSurface', ReactionAvatarSurface);

	if (!surfaceName) {
		logger.warn('Reaction avatars skipped: the avatar surface did not register.');

		return;
	}

	hookPlatform(context.native, surfaceName);
}
