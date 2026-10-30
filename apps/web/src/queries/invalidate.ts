import type { InvalidateQueryFilters, QueryClient } from '@tanstack/react-query';

import {
	accountOverviewKey,
	adminAddonsKey,
	adminUsersKey,
	dashboardKey,
	dashboardPageKey,
	marketplaceKey,
	reviewKey,
} from '~/queries/keys';

// The pages that show each kind of change, so a mutation names what it changed, not where it shows.
const VIEWS = {
	/** A user's role or ban lifted: the admin user pages. */
	user: [{ queryKey: adminUsersKey }],
	/** A ban also cancels the user's submissions, which the addon pages and the queue list. */
	ban: [{ queryKey: adminUsersKey }, { queryKey: adminAddonsKey }, { queryKey: reviewKey }],
	/** Staff changed an addon: its admin page, its owner's admin page and the public listing. */
	addon: [
		{ queryKey: adminAddonsKey },
		{ queryKey: adminUsersKey },
		{ queryKey: marketplaceKey },
	],
	/** A maintainer changed an addon's icon or maintainers: the dashboard and the public pages. */
	maintainedAddon: [{ queryKey: dashboardPageKey }, { queryKey: marketplaceKey }],
	/** `/submit` goes to the dashboard next, so a cached copy refetches now, not after it renders. */
	submission: [{ queryKey: dashboardPageKey, refetchType: 'all' }, { queryKey: reviewKey }],
	review: [{ queryKey: reviewKey }, { queryKey: dashboardKey }],
	/** An approval published a version. */
	release: [{ queryKey: marketplaceKey }],
	/** The badge shows on `/account`, next to the user on addon pages and on the Team pages. */
	badge: [{ queryKey: accountOverviewKey }, { queryKey: marketplaceKey }],
	/** Linked accounts and API keys. */
	account: [{ queryKey: accountOverviewKey }],
} satisfies Record<string, InvalidateQueryFilters[]>;

export type InvalidatedEntity = keyof typeof VIEWS;

/**
 * @description Refreshes every page that shows the changed entities.
 * @param client The query client.
 * @param entities What the mutation changed.
 * @returns Resolves once the active queries refetched.
 */
export async function invalidate(
	client: QueryClient,
	...entities: InvalidatedEntity[]
): Promise<void> {
	await Promise.all(
		entities.flatMap((entity) =>
			VIEWS[entity].map((filters: InvalidateQueryFilters) =>
				client.invalidateQueries(filters),
			),
		),
	);
}

export default { invalidate };
