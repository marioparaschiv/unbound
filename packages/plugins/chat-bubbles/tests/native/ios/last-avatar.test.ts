import { describe, expect, test } from 'bun:test';

import { lastAvatarFrame } from '~/native/ios/last-avatar';

describe('last avatar', () => {
	test("puts the avatar in its column, its bottom level with the last bubble's", () => {
		const avatar = { x: 16, y: 16, width: 40, height: 40 };
		const bubble = { x: 68, y: 0, width: 100, height: 60 };

		expect(lastAvatarFrame(bubble, avatar)).toEqual({ x: 16, y: 20, width: 40, height: 40 });
	});
});
