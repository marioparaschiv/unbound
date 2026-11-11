import hookMessageCells from '@unbound-plugins/shared/native/ios/message-cell-hooks';
import type { NativePluginBridge } from '@unbound-app/api/native';

import { disposeRenderer, messageCellHandlers, renderCell } from '~/native/renderer-ios';
import {
	listenToChannelChanges,
	listenToConnectionOpen,
	listenToReactionChanges,
} from '~/flux/listeners';
import { scanInitialCells } from '~/native/visible-cells-ios';
import { createSession } from '~/native/session-ios';
import { installHeightHook } from '~/native/ui-cell-heights-ios';
import { NativeClass } from '~/lib/constants';

let unhook: (() => void) | undefined;

/**
 * @description Opens the iOS session that draws avatars into Discord's native message cells: hooks their height on the UI thread,
 * hooks the cells as they appear, listens for reaction and channel changes and renders the cells already on screen.
 * @param native The plugin's native bridge.
 * @param surfaceName The registered avatar surface.
 */
export function hookReactions(native: NativePluginBridge, surfaceName: string): void {
	const { session, close } = createSession(native, surfaceName, renderCell);

	session.ui.run(installHeightHook, session.scope, NativeClass.messageCell);

	const unhookCells = hookMessageCells(session.objc, messageCellHandlers(session));

	listenToReactionChanges(session);
	listenToConnectionOpen(session);
	listenToChannelChanges(session);
	scanInitialCells(session);

	// Undoes the start in reverse: ends the session, unhooks the cells, then drops the drawn avatars and the UI scope.
	unhook = () => {
		close();
		unhookCells();
		disposeRenderer(session);
		session.scope.dispose();
	};
}

/**
 * @description Ends the iOS session and removes its native hooks and views, which the Addon scope cannot see.
 */
export function unhookReactions(): void {
	unhook?.();
	unhook = undefined;
}
