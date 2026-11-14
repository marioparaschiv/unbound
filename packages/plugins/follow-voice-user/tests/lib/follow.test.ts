import { describe, expect, test } from 'bun:test';

import { followStep, type Followed } from '~/lib/follow';

const followed: Followed = { userId: 'friend', name: 'Friend', channelId: 'a' };
const inVoice = { onlyWhenInVoice: true, inVoice: true, leaveWithThem: false };

describe('followStep', () => {
	test('joins the channel they moved to', () => {
		expect(followStep(followed, [{ userId: 'friend', channelId: 'b' }], inVoice)).toEqual({
			join: 'b',
		});
	});

	test('ignores other users and their current channel', () => {
		expect(
			followStep(followed, [{ userId: 'other', channelId: 'b' }], inVoice),
		).toBeUndefined();
		expect(
			followStep(followed, [{ userId: 'friend', channelId: 'a' }], inVoice),
		).toBeUndefined();
	});

	test('waits until you are in voice when asked', () => {
		expect(
			followStep(followed, [{ userId: 'friend', channelId: 'b' }], {
				...inVoice,
				inVoice: false,
			}),
		).toBeUndefined();
		expect(
			followStep(followed, [{ userId: 'friend', channelId: 'b' }], {
				...inVoice,
				onlyWhenInVoice: false,
				inVoice: false,
			}),
		).toEqual({ join: 'b' });
	});

	test('leaves with them only when asked', () => {
		const left = [{ userId: 'friend', channelId: null }];

		expect(followStep(followed, left, inVoice)).toBeUndefined();
		expect(followStep(followed, left, { ...inVoice, leaveWithThem: true })).toEqual({
			leave: true,
		});
	});
});
