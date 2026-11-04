import { playerKind } from '~/picture-in-picture/source';
import type { WebPlayers } from '~/picture-in-picture/web/web-players';
import type { PipWindow, WindowEvents } from '~/types';

/**
 * @description Sends web players, such as YouTube, to WebKit's own picture in picture window, and native videos to the native window.
 * The page's video plays in the window and reports when it closes.
 * @param native The window for native videos.
 * @param web The media viewer's web players.
 * @param events Called when a web player's window closes.
 * @returns A window that serves both kinds of player.
 */
export function withWebPlayers(
	native: PipWindow,
	web: WebPlayers,
	events: WindowEvents,
): PipWindow {
	let webActive = false;

	return {
		async enter(aspect, source) {
			if (playerKind(source) !== 'web') return native.enter(aspect, source);

			webActive = await web.enter(() => {
				if (!webActive) return;

				webActive = false;
				events.onEnded();
			});

			return webActive ? 'active' : 'failed';
		},
		exit() {
			if (!webActive) return native.exit();

			webActive = false;
			web.leave();

			return 'ended';
		},
		dispose() {
			webActive = false;
			web.dispose();
			native.dispose();
		},
	};
}
