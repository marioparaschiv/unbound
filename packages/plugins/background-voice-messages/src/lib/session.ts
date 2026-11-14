export const PLAYBACK = 'AVAudioSessionCategoryPlayback';
export const MIX_WITH_OTHERS = 1;

/**
 * @description Tells whether iOS suspends an app whose audio session has this category once it leaves the screen, which stops its audio. Calls use `PlayAndRecord` and are left alone. Runs on the UI thread.
 * @param category The session's category.
 * @returns Whether playback has to move to the `Playback` category to keep going.
 */
export function stopsInBackground(category: string): boolean {
	'worklet';

	return (
		category === 'AVAudioSessionCategoryAmbient' ||
		category === 'AVAudioSessionCategorySoloAmbient'
	);
}
