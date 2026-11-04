import hookMessageCells from '@unbound-plugins/shared/native/ios/message-cell-hooks';
import type { NativePluginBridge } from '@unbound-app/api/native';

import { disposeRenderer, messageCellHandlers, renderCell } from '~/reactions/ios/renderer';
import { subscribeChannelChanges } from '~/reactions/ios/events/selected-channel-change';
import { subscribeReactionChanges } from '~/reactions/ios/events/message-reaction';
import { subscribeConnectionOpen } from '~/reactions/ios/events/connection-open';
import { scanInitialCells } from '~/reactions/ios/visible-cells';
import { createSession } from '~/reactions/ios/session';
import { installHeightHook } from '~/reactions/ios/ui-cell-heights';
import { NativeClass } from '~/constants';
import type { Feature } from '~/types';

/**
 * @description Opens the iOS session that draws avatars into Discord's native message cells.
 * @param native The plugin's native bridge.
 * @param surfaceName The registered avatar surface.
 * @returns The features to apply, in order.
 */
export function reactionFeatures(native: NativePluginBridge, surfaceName: string): Feature[] {
	const { session, close } = createSession(native, surfaceName, renderCell);

	return [
		() => {
			session.ui.run(installHeightHook, session.scope, NativeClass.messageCell);

			return () => session.scope.dispose();
		},
		() => () => disposeRenderer(session),
		() => hookMessageCells(session.objc, messageCellHandlers(session)),
		() => {
			subscribeReactionChanges(session);
			subscribeConnectionOpen(session);
			subscribeChannelChanges(session);
			scanInitialCells(session);

			return close;
		},
	];
}

export default reactionFeatures;
