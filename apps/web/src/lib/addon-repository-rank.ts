import type { PushableRepository } from '@unbound-app/contracts/source';

// Repository names built from one of each, such as `unbound-addons`, `ub-plugins` or `unbound-themes`.
const PRODUCT_WORDS = ['unbound', 'ub'];
const KIND_WORDS = ['addons', 'addon', 'plugins', 'plugin', 'themes', 'theme'];

const ADDON_NAMES = new Set(
	PRODUCT_WORDS.flatMap((product) =>
		KIND_WORDS.flatMap((kind) => [
			`${product}-${kind}`,
			`${product}_${kind}`,
			`${product}${kind}`,
		]),
	),
);

/**
 * @description Scores how likely a repository holds Unbound addons, from its name alone.
 * @param repository The repository as `owner/name`.
 * @returns 3 for a name like `unbound-addons`, 2 for one with a product and a kind word, 1 for one of either, else 0.
 */
export function scoreAddonRepository(repository: string): number {
	const name = (repository.split('/')[1] ?? '').toLowerCase();

	if (ADDON_NAMES.has(name)) return 3;

	const words = name.split(/[-_.]/);
	const product = words.some((word) => PRODUCT_WORDS.includes(word));
	const kind = words.some((word) => KIND_WORDS.includes(word));

	return Number(product) + Number(kind);
}

/**
 * @description Orders repositories so the likeliest addon repositories come first, keeping the given order within a score.
 * @param repositories The repositories, most recently pushed first.
 * @returns A new array, sorted by score.
 */
export function rankAddonRepositories(repositories: PushableRepository[]): PushableRepository[] {
	return repositories
		.map((entry, index) => ({ entry, index, score: scoreAddonRepository(entry.repository) }))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map(({ entry }) => entry);
}

export default { scoreAddonRepository, rankAddonRepositories };
