import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import hookMessageCells from '@unbound-plugins/shared/native/message-cell-hooks';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
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
import { disposeRenderer, messageCellHandlers, renderCell } from '~/native/renderer';
import ReactionAvatarSurface from '~/components/reaction-avatar-surface';
import { subscribeChannelChanges } from '~/events/selected-channel-change';
import { subscribeReactionChanges } from '~/events/message-reaction';
import { subscribeConnectionOpen } from '~/events/connection-open';
import { scanInitialCells } from '~/native/visible-cells';
import { createSession } from '~/native/session';

let dispose = () => {};

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

	const { session, close } = createSession(context.native, surfaceName, renderCell);

	dispose = applyFeatures('Reaction Avatars', [
		() => () => disposeRenderer(session),
		() => hookMessageCells(session.objc, messageCellHandlers(session)),
		() => subscribeReactionChanges(session),
		() => subscribeConnectionOpen(session),
		() => subscribeChannelChanges(session),
		() => scanInitialCells(session),
		() => close,
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
