import { expect, test } from 'bun:test';

import { isSponsorBadgeId, toSponsorBadges } from './sponsor-badge-shapes';

const BADGES = [
	{
		name: 'Moon',
		imageUrl: 'https://cdn.unbound.rip/badges/moon.png',
		kind: 'custom-badge' as const,
	},
	{
		name: 'Star',
		imageUrl: 'https://cdn.unbound.rip/badges/star.png',
		kind: 'custom-badge' as const,
	},
];

test('maps sponsor badges to Discord profile badges that load their uploaded image', () => {
	const { profile } = toSponsorBadges(BADGES, 'From sponsoring Unbound');

	expect(profile).toEqual([
		{ id: 'unbound-sponsor-0', description: 'Moon', icon: '', iconSrc: BADGES[0].imageUrl },
		{ id: 'unbound-sponsor-1', description: 'Star', icon: '', iconSrc: BADGES[1].imageUrl },
	]);
});

test('lists each profile badge in the badge directory as an owned badge under the same id', () => {
	const { profile, catalog } = toSponsorBadges(BADGES, 'From sponsoring Unbound');

	expect(catalog.map((badge) => badge.badge_id)).toEqual(profile.map((badge) => badge.id));
	expect(catalog[1]).toMatchObject({
		name: 'Star',
		description: 'From sponsoring Unbound',
		simple_icon_raster_url: BADGES[1].imageUrl,
		owned: true,
		hidden: false,
	});
});

test('tells sponsor badge ids from the ids of Discord badges', () => {
	const [badge] = toSponsorBadges(BADGES, '').profile;

	expect(isSponsorBadgeId(badge.id)).toBe(true);
	expect(isSponsorBadgeId('account_age')).toBe(false);
	expect(isSponsorBadgeId(18)).toBe(false);
});

test('maps no badges to empty lists', () => {
	expect(toSponsorBadges([], 'From sponsoring Unbound')).toEqual({ profile: [], catalog: [] });
});
