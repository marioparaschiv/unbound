/** Every marketplace query key starts with this: listings, addon pages, Team pages and authors. */
export const marketplaceKey = ['marketplace'] as const;

/** Every dashboard query key starts with this: the page and its maintainer lists. */
export const dashboardKey = ['dashboard'] as const;

/** The `/dashboard` page alone, without the maintainer lists below {@link dashboardKey}. */
export const dashboardPageKey = [...dashboardKey, 'page'] as const;

/** Every review query key starts with this, so invalidating it refreshes every kind filter. */
export const reviewKey = ['review'] as const;

/** Every admin addons query key starts with this: the list pages and each addon's page. */
export const adminAddonsKey = ['admin-addons'] as const;

/** Every admin users query key starts with this: the list pages, each user's page and the search. */
export const adminUsersKey = ['admin-users'] as const;

/** What `/account` manages: linked accounts, API keys and sponsorship. */
export const accountOverviewKey = ['account', 'overview'] as const;

export default {
	marketplaceKey,
	dashboardKey,
	dashboardPageKey,
	reviewKey,
	adminAddonsKey,
	adminUsersKey,
	accountOverviewKey,
};
