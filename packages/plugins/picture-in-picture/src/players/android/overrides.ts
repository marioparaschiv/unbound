import type { SessionProps } from '~/types';

/**
 * @description The `RCTVideo` props that keep an Android video playing while Discord's activity is in picture in picture.
 * @param session The session, or `null` when the player has none.
 * @param loop Whether the video loops while it is in the window.
 * @returns The props to set on top of the player's own, or `null` when there is no session.
 */
export const sessionProps: SessionProps = (session, loop) => {
	if (!session) return null;

	return {
		paused: false,
		repeat: loop,
		playInBackground: true,
	};
};
