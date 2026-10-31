import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	ChannelStore,
	findUserSummaryItem,
	MessageStore,
	ReactionActions,
	SelectedChannelStore,
	UserStore,
} from '~/modules';
import ReactionAvatarSurface from '~/components/reaction-avatar-surface';
import { reactionFeatures } from '~/platform';

let dispose: () => Promise<void> | undefined = () => undefined;

function start(context: PluginContext) {
	const modules = {
		getReactors: ReactionActions.getReactors,
		UserSummaryItem: findUserSummaryItem(),
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

function stop() {
	const finished = dispose();

	dispose = () => undefined;

	return finished;
}

export default { start, stop, selfTest: featureSelfTest };
