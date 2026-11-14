import { describe, expect, test } from 'bun:test';

import { isUserpfpData, userpfpAvatar } from '~/lib/userpfp';

const data = {
	avatars: {
		'123': 'https://raw.githubusercontent.com/UserPFP/img/main/Avatars/1/123.gif',
		'456': 'https://raw.githubusercontent.com/UserPFP/img/main/Avatars/4/456.png',
	},
};

describe('userpfp', () => {
	test('links a listed user to their animated avatar', () => {
		expect(userpfpAvatar(data, '123', true)).toBe(data.avatars['123']);
	});

	test('uses the still PNG when Discord does not animate', () => {
		expect(userpfpAvatar(data, '123', false)).toBe(
			'https://raw.githubusercontent.com/UserPFP/img/main/Avatars/1/123.png',
		);
		expect(userpfpAvatar(data, '456', false)).toBe(data.avatars['456']);
	});

	test('gives nothing for an unlisted user or before the list loads', () => {
		expect(userpfpAvatar(data, '789', true)).toBeUndefined();
		expect(userpfpAvatar(undefined, '123', true)).toBeUndefined();
	});

	test('recognises the list shape', () => {
		expect(isUserpfpData(data)).toBe(true);
		expect(isUserpfpData({ users: {} })).toBe(false);
	});
});
