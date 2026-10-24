import { describe, expect, test } from 'bun:test';

import type { Mention } from '~/mentions';

import { IMAGE_CHARACTER, IMAGE_PADDING, planPlacements } from './placements';

const adrian: Mention = { labels: ['adrián'], type: 'user', avatarURL: 'https://cdn/a.png' };
const mods: Mention = { labels: ['Mods'], type: 'role', avatarURL: 'https://cdn/r.png' };

describe('android mention placements', () => {
	test('puts a user image before the mention inside its pill', () => {
		const text = '⁨@adrián⁩ fresh mention fixture';
		const [placement] = planPlacements(text, [{ start: 1, end: 8 }], [adrian], true);

		expect(placement).toMatchObject({
			mention: adrian,
			replaceStart: 1,
			replaceEnd: 1,
			insertion: `${IMAGE_PADDING}${IMAGE_CHARACTER}${IMAGE_PADDING}`,
			imageOffset: 1,
		});
	});

	test('replaces the @ when the setting hides it', () => {
		const text = '⁨@adrián⁩';
		const [placement] = planPlacements(text, [{ start: 1, end: 8 }], [adrian], false);

		expect(placement).toMatchObject({ replaceStart: 1, replaceEnd: 2 });
	});

	test('puts a role image after the role name', () => {
		const text = 'hi ⁨@Mods⁩';
		const [placement] = planPlacements(text, [{ start: 4, end: 9 }], [mods], true);

		expect(placement).toMatchObject({
			replaceStart: 9,
			insertion: `${IMAGE_PADDING}${IMAGE_CHARACTER}${IMAGE_PADDING}`,
			imageOffset: 1,
		});
	});

	test('skips tappable spans that are not a known mention', () => {
		const text = 'see ⁨#showcase⁩ and ⁨@someone⁩';

		expect(
			planPlacements(
				text,
				[
					{ start: 5, end: 14 },
					{ start: 21, end: 29 },
				],
				[adrian],
				true,
			),
		).toEqual([]);
	});

	test('skips a mention that already has its image', () => {
		const text = `⁨${IMAGE_PADDING}${IMAGE_CHARACTER}${IMAGE_PADDING}@adrián⁩`;

		expect(planPlacements(text, [{ start: 4, end: 11 }], [adrian], true)).toEqual([]);
	});

	test('orders placements last first', () => {
		const text = '⁨@adrián⁩ and ⁨@adrián⁩';
		const placements = planPlacements(
			text,
			[
				{ start: 1, end: 8 },
				{ start: 15, end: 22 },
			],
			[adrian],
			true,
		);

		expect(placements.map((placement) => placement.replaceStart)).toEqual([15, 1]);
	});
});
