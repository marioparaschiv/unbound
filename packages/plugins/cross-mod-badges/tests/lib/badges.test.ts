import { describe, expect, test } from 'bun:test';

import { BADGE_API, toProfileBadges } from '~/lib/badges';

const label = (mod: string, name: string) => `${mod}: ${name}`;

describe('toProfileBadges', () => {
	test('names badges by mod, with the API icon or their own', () => {
		expect(
			toProfileBadges(
				{
					Vencord: ['Contributor'],
					BadgeVault: [{ name: 'Astronaut', badge: 'https://gb.example/a.png' }],
					Replugged: [],
				},
				label,
			),
		).toEqual([
			{
				id: 'unbound-cross-mod-Vencord-Contributor',
				description: 'Vencord: Contributor',
				icon: '',
				iconSrc: `${BADGE_API}/badges/Vencord/Contributor`,
			},
			{
				id: 'unbound-cross-mod-BadgeVault-Astronaut',
				description: 'BadgeVault: Astronaut',
				icon: '',
				iconSrc: 'https://gb.example/a.png',
			},
		]);
	});

	test('ignores answers it cannot read', () => {
		expect(toProfileBadges(null, label)).toEqual([]);
		expect(toProfileBadges({ Enmity: 'supporter', Aliucord: [{}] }, label)).toEqual([]);
	});
});
