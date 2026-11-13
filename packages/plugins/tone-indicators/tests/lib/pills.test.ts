import { describe, expect, test } from 'bun:test';

import { splitTones } from '~/lib/pills';
import { customTones } from '~/lib/tones';

const pill = (formatted: string, full: string) =>
	expect.objectContaining({ type: 'timestamp', formatted, full });

describe('tone pills', () => {
	test('turns known tags into pills and keeps the text around them', () => {
		expect(splitTones('i love it /j, really /SRS.', {})).toEqual([
			{ type: 'text', content: 'i love it ' },
			pill('/j joking', 'Joking'),
			{ type: 'text', content: ', really ' },
			pill('/SRS serious', 'Serious'),
			{ type: 'text', content: '.' },
		]);
	});

	test('leaves paths, links and unknown tags alone', () => {
		expect(splitTones('see /r/unbound and a/s and /zzz', {})).toBeUndefined();
		expect(splitTones('https://x.com/j', {})).toBeUndefined();
	});

	test("reads the user's own tags first", () => {
		const custom = customTones(['rp=Roleplay', '/j = Just kidding', 'broken', '=x']);

		expect(custom).toEqual({ rp: 'Roleplay', j: 'Just kidding' });
		expect(splitTones('/rp /j', custom, false)).toEqual([
			pill('/rp', 'Roleplay'),
			{ type: 'text', content: ' ' },
			pill('/j', 'Just kidding'),
		]);
	});
});
