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

test('gives a GIF badge the URLs Discord plays in the directory and details sheet, and a PNG still ones', () => {
	const gif = 'https://cdn.unbound.rip/badges/0a1b.gif';
	const [still, animated] = toSponsorBadges(
		[BADGES[0], { name: 'Party', imageUrl: gif, kind: 'custom-badge' }],
		'',
	).catalog;

	expect(still).not.toHaveProperty('complex_icon_animated_url');
	expect(still).toMatchObject({ simple_icon_url: BADGES[0].imageUrl });
	expect(animated).not.toHaveProperty('simple_icon_url');
	expect(animated).toMatchObject({ complex_icon_animated_url: gif, simple_icon_raster_url: gif });
});

test('maps no badges to empty lists', () => {
	expect(toSponsorBadges([], 'From sponsoring Unbound')).toEqual({ profile: [], catalog: [] });
});
