import { expect, test } from 'bun:test';

import { mimeTypeOf } from '~/lib/mime-types';

test('guesses types from extensions', () => {
	expect(mimeTypeOf('IMG_1.HEIC')).toBe('image/heic');
	expect(mimeTypeOf('clip.mov')).toBe('video/quicktime');
	expect(mimeTypeOf('notes')).toBe('application/octet-stream');
});
