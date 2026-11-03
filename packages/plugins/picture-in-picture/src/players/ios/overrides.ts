import type { SessionProps } from '~/types';

/**
 * @description The `RCTVideo` props that run an iOS picture in picture session.
 * @param session The session, or `null` when the player has none.
 * @param loop Whether the video loops while it is in the window.
 * @returns The props to set on top of the player's own, or `null` when there is no session.
 */
export const sessionProps: SessionProps = (session, loop) => {
	if (!session) return null;

	return {
		pictureInPicture: session.phase !== 'stopping',
		paused: false,
		repeat: loop,
		playWhenInactive: true,
		ignoreSilentSwitch: 'ignore',
		restoreUserInterfaceForPIPStopCompletionHandler: session.restore,
	};
};
