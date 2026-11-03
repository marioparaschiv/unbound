import type { CreateWindow } from '~/types';

/**
 * @description The iOS window needs no native call: `RCTVideo` starts and stops its own `AVPictureInPictureController` when the player's `pictureInPicture` prop changes.
 * @returns A window whose `enter` and `exit` leave the player's props to open and close it, and wait for its status events.
 */
export const createWindow: CreateWindow = () => ({
	enter: () => Promise.resolve('pending'),
	exit: () => 'pending',
	dispose: () => {},
});
