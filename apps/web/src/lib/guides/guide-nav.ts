/** A docs tab of hand-written guides; its pages are `docs/<tab>/**.mdx`. */
export type GuideTab = 'user' | 'developer';

/** A sidebar section; each slug is a page's path under `docs/<tab>/`, without `.mdx`. */
export type GuideGroup = {
	label: string;
	slugs: string[];
};

export type GuideTabNav = {
	tab: GuideTab;
	label: string;
	groups: GuideGroup[];
};

/** Every guide page in sidebar order. A test keeps it in step with the files in `docs/`. */
export const GUIDE_NAV: Record<GuideTab, GuideTabNav> = {
	user: {
		tab: 'user',
		label: 'User guide',
		groups: [
			{ label: 'Get Started', slugs: ['overview', 'installing', 'updating', 'roadmap'] },
			{
				label: 'Using Unbound',
				slugs: [
					'managing-addons',
					'marketplace',
					'settings',
					'fonts',
					'sync',
					'ios-extensions',
				],
			},
			{ label: 'Help', slugs: ['troubleshooting', 'privacy'] },
		],
	},
	developer: {
		tab: 'developer',
		label: 'Developer guide',
		groups: [
			{
				label: 'Addons',
				slugs: [
					'addons/introduction',
					'addons/creating',
					'addons/standards',
					'addons/manifest',
					'addons/store-page',
				],
			},
			{
				label: 'Plugins',
				slugs: [
					'plugins/introduction',
					'plugins/react-patching',
					'plugins/flux',
					'plugins/ui-thread',
				],
			},
			{
				label: 'Themes',
				slugs: ['themes/introduction', 'themes/types', 'themes/backgrounds'],
			},
			{ label: 'Icon Packs', slugs: ['icon-packs/introduction'] },
			{
				label: 'Development',
				slugs: ['development/debugging', 'development/cli', 'development/local-builds'],
			},
			{
				label: 'Loader',
				slugs: [
					'loader/introduction',
					'loader/ios',
					'loader/android',
					'loader/configuration',
					'loader/settings',
				],
			},
		],
	},
};

/**
 * @description Lists a tab's pages in sidebar order.
 * @param tab The guide tab.
 * @returns Every slug of the tab.
 */
export function getGuideSlugs(tab: GuideTab): string[] {
	return GUIDE_NAV[tab].groups.flatMap((group) => group.slugs);
}

export default { GUIDE_NAV, getGuideSlugs };
