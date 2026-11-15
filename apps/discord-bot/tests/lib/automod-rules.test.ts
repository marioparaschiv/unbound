import { describe, expect, test } from 'bun:test';

import {
	countCaps,
	createRateCounter,
	findBadWord,
	findBlacklistedLink,
	findInviteCodes,
	isRateOn,
} from '~/lib/automod-rules';

describe('findInviteCodes', () => {
	test('finds each invite code once, in every form', () => {
		expect(
			findInviteCodes(
				'join discord.gg/abc and https://discord.com/invite/x-y or discordapp.com/invite/abc',
			),
		).toEqual(['abc', 'x-y']);
		expect(findInviteCodes('discord.com/channels/1/2')).toEqual([]);
	});
});

describe('findBadWord', () => {
	test('matches any case inside words, ignoring punctuation', () => {
		expect(findBadWord('You are a S.c.a.m-mer', ['scam'])).toBe('scam');
		expect(findBadWord('all fine', ['scam', ''])).toBeUndefined();
	});
});

describe('findBlacklistedLink', () => {
	test('matches a domain and its subdomains, not lookalikes', () => {
		expect(findBlacklistedLink('see https://www.grabify.link/x', ['grabify.link'])).toBe(
			'grabify.link',
		);
		expect(
			findBlacklistedLink('see https://notgrabify.link', ['grabify.link']),
		).toBeUndefined();
	});
});

describe('countCaps', () => {
	test('counts upper case letters', () => {
		expect(countCaps('HELLO there É')).toBe(6);
	});
});

describe('createRateCounter', () => {
	test('trips once the count is reached within the window, and forgets older hits', () => {
		const counter = createRateCounter();
		const rate = { count: 3, seconds: 10 };

		expect(counter.hit('a', 1, rate, 0)).toBe(false);
		expect(counter.hit('a', 1, rate, 5000)).toBe(false);
		expect(counter.hit('a', 1, rate, 11_000)).toBe(false);
		expect(counter.hit('a', 2, rate, 12_000)).toBe(true);

		counter.reset('a');

		expect(counter.hit('a', 1, rate, 12_500)).toBe(false);
	});

	test('a zero in a rate turns its rule off', () => {
		expect(isRateOn({ count: 0, seconds: 10 })).toBe(false);
		expect(isRateOn({ count: 3, seconds: 0 })).toBe(false);
		expect(isRateOn({ count: 3, seconds: 10 })).toBe(true);
	});
});
