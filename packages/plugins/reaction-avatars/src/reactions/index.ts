import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	ChannelStore,
	MessageStore,
	ReactionActions,
	SelectedChannelStore,
	UserStore,
} from '~/reactions/modules';
import ReactionAvatarSurface from '~/reactions/components/reaction-avatar-surface';
import { reactionFeatures } from '~/reactions/platform';
import type { Feature } from '~/types';

/**
 * @description Draws the first reactors' avatars beside each message reaction.
 * Reads `ReactionActionCreators` to fetch reactors, and `UserSummaryItem`, found when a reaction first renders, to draw
 * the faces. Reads `ChannelStore`, `MessageStore`, `SelectedChannelStore` and `UserStore`. iOS hooks Discord's native message cells
 * and Android hooks its reaction views, so each platform's hooks are native and need `stop` to remove them.
 * @param context The plugin's context, whose native bridge hooks the message views.
 * @returns The platform's features, which start together; `undefined` when the plugin skipped starting.
 */
export function startReactions(context: PluginContext): Feature[] | undefined {
	// `UserSummaryItem` is found when a reaction first renders, and the surface renders nothing without it.
	const modules = {
		ReactionActions,
		ChannelStore,
		MessageStore,
		SelectedChannelStore,
		UserStore,
	};

	if (!ensureCapabilities(context.native, context.capabilities) || !ensureModules(modules)) {
		return;
	}

	const surfaceName = registerAppSurface('ReactionAvatarSurface', ReactionAvatarSurface);

	if (!surfaceName) {
		skipFeature('the avatar surface did not register');

		return;
	}

	return reactionFeatures(context.native, surfaceName);
}
