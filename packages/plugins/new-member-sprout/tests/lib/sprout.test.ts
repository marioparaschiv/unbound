import { describe, expect, test } from 'bun:test';

import { isNewMember, isSproutSource, sproutIcon, sproutSource } from '~/lib/sprout';

const NOW = Date.parse('2026-11-16T12:00:00Z');
const OLD_GUILD = '81384788765712384';
const NEW_GUILD = String(BigInt(NOW - 2 * 24 * 60 * 60 * 1000 - 1420070400000) << 22n);

const member = (joinedAt: string | undefined, extra: object = {}) => ({
	guildId: OLD_GUILD,
	joinedAt,
	...extra,
});

describe('isNewMember', () => {
	test('counts members who joined within the last week', () => {
		expect(isNewMember(member('2026-11-14T12:00:00Z'), NOW)).toBe(true);
		expect(isNewMember(member('2026-11-08T12:00:00Z'), NOW)).toBe(false);
	});

	test('ignores missing, invalid and future join dates', () => {
		expect(isNewMember(member(undefined), NOW)).toBe(false);
		expect(isNewMember(member('soon'), NOW)).toBe(false);
		expect(isNewMember(member('2026-11-20T12:00:00Z'), NOW)).toBe(false);
	});

	test('skips bots, members who rejoined and servers younger than a week, as desktop does', () => {
		expect(isNewMember(member('2026-11-14T12:00:00Z', { bot: true }), NOW)).toBe(false);
		expect(isNewMember(member('2026-11-14T12:00:00Z', { flags: 1 }), NOW)).toBe(false);
		expect(isNewMember({ guildId: NEW_GUILD, joinedAt: '2026-11-15T12:00:00Z' }, NOW)).toBe(
			false,
		);
	});
});

describe('sproutSource', () => {
	test('draws a PNG in the color, once per color', () => {
		const source = sproutSource('#7ecb94');

		expect(source?.startsWith('data:image/png;base64,iVBORw0KGgo')).toBe(true);
		expect(sproutSource('#7ecb94')).toBe(source);
		expect(isSproutSource(source)).toBe(true);
		expect(isSproutSource('https://cdn.discordapp.com/role-icons/1.png')).toBe(false);
	});

	test('rejects colors it cannot read', () => {
		expect(sproutSource('green')).toBeUndefined();
	});
});

describe('sproutIcon', () => {
	test('shows the image at desktop size', () => {
		expect(sproutIcon('data:x', 'New')).toEqual({
			source: 'data:x',
			name: 'New',
			size: 20,
			alt: 'New',
		});
	});
});
