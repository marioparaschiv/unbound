import { describe, expect, test } from 'bun:test';

import { withFriendLabel } from '~/lib/marker';

describe('withFriendLabel', () => {
	test('adds the label, keeping an OP label and the main tag', () => {
		expect(withFriendLabel({ tagText: null, opTagText: null }, 'Friend')).toMatchObject({
			opTagText: 'Friend',
			tagAccessibilityLabel: 'Friend',
		});
		expect(withFriendLabel({ tagText: 'BOT', opTagText: 'OP' }, 'Friend')).toMatchObject({
			tagText: 'BOT',
			opTagText: 'OP · Friend',
		});
	});
});
