import { describe, expect, test } from 'bun:test';

import { rankAddonRepositories, scoreAddonRepository } from '~/lib/addon-repository-rank';

function pushable(repository: string) {
	return { repository, description: null, pushedAt: null, ownerAvatarUrl: null };
}

describe('scoreAddonRepository', () => {
	test.each([
		['acme/unbound-addons', 3],
		['acme/ub-addons', 3],
		['acme/unbound-plugins', 3],
		['acme/Unbound-Themes', 3],
		['acme/ub_theme', 3],
		['acme/unbound-plugin-pack', 2],
		['acme/my-themes', 1],
		['acme/unbound', 1],
		['unbound/website', 0],
		['acme/dotfiles', 0],
	])('%s scores %d', (repository, score) => {
		expect(scoreAddonRepository(repository)).toBe(score);
	});
});

describe('rankAddonRepositories', () => {
	test('puts likely addon repositories first and keeps recency within a score', () => {
		const ranked = rankAddonRepositories(
			['a/dotfiles', 'a/my-themes', 'b/unbound-addons', 'c/website', 'd/ub-plugins'].map(
				pushable,
			),
		);

		expect(ranked.map((entry) => entry.repository)).toEqual([
			'b/unbound-addons',
			'd/ub-plugins',
			'a/my-themes',
			'a/dotfiles',
			'c/website',
		]);
	});
});
