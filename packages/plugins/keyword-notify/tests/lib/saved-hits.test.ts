import { describe, expect, test } from 'bun:test';

import {
	forgetHit,
	hitsForPage,
	parseSavedHits,
	rememberHit,
	type HitPage,
	type SavedHit,
} from '~/lib/saved-hits';

const hit = (id: string, channel_id = 'c1'): SavedHit => ({ id, channel_id, content: id });

const page = (ids: string[], overrides: Partial<HitPage> = {}): HitPage => ({
	ids,
	isAfter: false,
	hasMore: true,
	...overrides,
});

const idsOf = (messages: { id: string }[]) => messages.map((message) => message.id);

describe('saved keyword hits', () => {
	test('remembers the newest hit first, once, up to the limit', () => {
		const list = rememberHit(rememberHit([hit('10'), hit('9')], hit('12'), 3), hit('10'), 3);

		expect(idsOf(list)).toEqual(['12', '10', '9']);
		expect(idsOf(rememberHit(list, hit('13'), 3))).toEqual(['13', '12', '10']);
	});

	test('forgets a dismissed hit', () => {
		expect(idsOf(forgetHit([hit('2'), hit('1')], '2'))).toEqual(['1']);
	});

	test('drops malformed entries when reading storage', () => {
		expect(idsOf(parseSavedHits([hit('5'), { id: 6 }, null, 'x', hit('7')]))).toEqual([
			'7',
			'5',
		]);
		expect(parseSavedHits({})).toEqual([]);
	});

	test('compares ids as snowflakes, not strings', () => {
		expect(idsOf(rememberHit([hit('99')], hit('100'), 5))).toEqual(['100', '99']);
	});
});

describe('hits that belong in a loaded page', () => {
	const hits = [hit('500'), hit('350'), hit('250'), hit('50')];

	test('the first page takes hits newer than its oldest mention', () => {
		const merged = hitsForPage(page(['400', '300']), hits, { guildOf: () => null });

		expect(idsOf(merged)).toEqual(['500', '350']);
	});

	test('the last page takes every older hit', () => {
		const merged = hitsForPage(page(['400', '300'], { hasMore: false }), hits, {
			guildOf: () => null,
		});

		expect(idsOf(merged)).toEqual(['500', '350', '250', '50']);
	});

	test('a later page takes only hits between the list so far and its own oldest mention', () => {
		const merged = hitsForPage(page(['200', '100'], { isAfter: true }), hits, {
			guildOf: () => null,
			listOldestId: '300',
		});

		expect(idsOf(merged)).toEqual(['250']);
	});

	test('an empty last page still takes the remaining older hits', () => {
		const merged = hitsForPage(page([], { isAfter: true, hasMore: false }), hits, {
			guildOf: () => null,
			listOldestId: '300',
		});

		expect(idsOf(merged)).toEqual(['250', '50']);
	});

	test('skips a hit Discord already returned', () => {
		const merged = hitsForPage(page(['500', '300']), hits, { guildOf: () => null });

		expect(idsOf(merged)).toEqual(['350']);
	});

	test("follows the inbox's server filter and skips ignored hits", () => {
		const mixed = [hit('500', 'in-guild'), hit('450', 'elsewhere'), hit('420', 'ignored')];
		const merged = hitsForPage(page(['400']), mixed, {
			guildId: 'g1',
			guildOf: (channelId) => (channelId === 'elsewhere' ? 'g2' : 'g1'),
			isIgnored: (message) => message.channel_id === 'ignored',
		});

		expect(idsOf(merged)).toEqual(['500']);
	});
});
