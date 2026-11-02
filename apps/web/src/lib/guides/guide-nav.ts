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
	/** Old slugs of moved or merged pages, mapped to the page that now holds their content. */
	redirects?: Record<string, string>;
};

/** Every guide page in sidebar order. A test keeps it in step with the files in `docs/`. */
export const GUIDE_NAV: Record<GuideTab, GuideTabNav> = {
	user: {
		tab: 'user',
		label: 'User guide',
		groups: [
			{ label: 'Get Started', slugs: ['overview', 'installing', 'updating'] },
			{ label: 'Addons', slugs: ['marketplace', 'managing-addons', 'fonts'] },
			{ label: 'Settings', slugs: ['settings', 'sync', 'ios-extensions'] },
			{ label: 'Help', slugs: ['troubleshooting', 'privacy', 'roadmap'] },
		],
	},
	developer: {
		tab: 'developer',
		label: 'Developer guide',
		// Fundamentals before what builds on them: each group assumes only the groups above it.
		groups: [
			{ label: 'Start Here', slugs: ['concepts', 'addons/creating'] },
			{
				label: 'Addons',
				slugs: ['addons/manifest', 'addons/standards', 'addons/store-page'],
			},
			{
				label: 'Plugins',
				slugs: [
					'plugins/introduction',
					'plugins/metro',
					'plugins/patching',
					'plugins/react-patching',
					'plugins/flux',
				],
			},
			{
				label: 'Plugin Features',
				slugs: [
					'plugins/settings',
					'plugins/commands',
					'plugins/feedback',
					'plugins/i18n',
					'plugins/ui-thread',
				],
			},
			{
				label: 'Themes and Icons',
				slugs: [
					'themes/introduction',
					'themes/types',
					'themes/backgrounds',
					'icon-packs/introduction',
				],
			},
			{ label: 'Tools', slugs: ['development/cli', 'development/debugging'] },
			{ label: 'Core Development', slugs: ['development/local-builds'] },
			{
				label: 'Under the Hood',
				slugs: ['loader/introduction', 'loader/ios', 'loader/android', 'loader/settings'],
			},
		],
		redirects: {
			'addons/introduction': 'concepts',
			'loader/configuration': 'loader/settings',
		},
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
