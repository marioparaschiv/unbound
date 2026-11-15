import { describe, expect, test } from 'bun:test';

import { starboardEmojiNames } from '~/starboard/starboard-emojis';

describe('starboardEmojiNames', () => {
	test('names only the starboard avatar and copied emojis a post shows', () => {
		const text =
			'<:sb_263689920210534400_203c047c:1571505728349274132> **eternal** <:mb_star_2:1571500046200082584> hi <a:se_839404302253948949:1571505771001286738> <:logo:960422659861151777>';

		expect(starboardEmojiNames(text)).toEqual([
			'sb_263689920210534400_203c047c',
			'se_839404302253948949',
		]);
	});
});
