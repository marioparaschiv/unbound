import { expect, test } from 'bun:test';

import { stopsInBackground } from '~/lib/session';

test('moves only ambient sessions, never calls or playback', () => {
	expect(stopsInBackground('AVAudioSessionCategoryAmbient')).toBe(true);
	expect(stopsInBackground('AVAudioSessionCategorySoloAmbient')).toBe(true);
	expect(stopsInBackground('AVAudioSessionCategoryPlayAndRecord')).toBe(false);
	expect(stopsInBackground('AVAudioSessionCategoryPlayback')).toBe(false);
});
