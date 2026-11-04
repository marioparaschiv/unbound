import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	ChannelStore,
	MessageStore,
	ReactionActions,
	SelectedChannelStore,
	UserStore,
} from '~/modules';
import ReactionAvatarSurface from '~/components/reaction-avatar-surface';
import { reactionFeatures } from '~/platform';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start(context: PluginContext) {
	// `UserSummaryItem` is found when a reaction first renders, and the surface renders nothing without it.
	const modules = {
		ReactionActions,
		ChannelStore,
		MessageStore,
		SelectedChannelStore,
		UserStore,
	};

	if (
		!ensureCapabilities('Reaction Avatars', context.native, context.capabilities) ||
		!ensureModules('Reaction Avatars', modules)
	) {
		return;
	}

	const surfaceName = registerAppSurface('ReactionAvatarSurface', ReactionAvatarSurface);

	if (!surfaceName) {
		console.error('[Reaction Avatars] Skipped, the avatar surface did not register.');

		return;
	}

	dispose = applyFeatures('Reaction Avatars', reactionFeatures(context.native, surfaceName));
}

export function stop() {
	const finished = dispose();

	dispose = () => undefined;

	return finished;
}

export { featureSelfTest as selfTest };
