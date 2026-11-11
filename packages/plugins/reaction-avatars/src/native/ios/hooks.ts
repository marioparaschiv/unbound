import hookMessageCells from '@unbound-plugins/shared/native/ios/message-cell-hooks';
import type { NativeBridge } from '@unbound-app/api/native';

import { disposeRenderer, messageCellHandlers, renderCell } from '~/native/ios/renderer';
import {
	listenToChannelChanges,
	listenToConnectionOpen,
	listenToReactionChanges,
} from '~/flux/listeners';
import { scanInitialCells } from '~/native/ios/visible-cells';
import { createSession } from '~/native/ios/session';
import { installHeightHook } from '~/native/ios/ui-cell-heights';
import { NativeClass } from '~/lib/constants';

let unhook: (() => void) | undefined;

/**
 * @description Opens the iOS session that draws avatars into Discord's native message cells: hooks their height on the UI thread,
 * hooks the cells as they appear, listens for reaction and channel changes and renders the cells already on screen.
 * @param native The plugin's native bridge.
 * @param surfaceName The registered avatar surface.
 */
export function hookReactions(native: NativeBridge, surfaceName: string): void {
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
