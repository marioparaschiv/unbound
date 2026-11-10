import type { GuideIconName } from '~/lib/guides/guide-icon-names';

/** A docs tab of hand-written guides; its pages are `docs/<tab>/**.mdx`. */
export type GuideTab = 'user' | 'developer';

/** A collapsible set of pages inside a sidebar section. */
export type GuideFolder = {
	label: string;
	icon: GuideIconName;
	slugs: string[];
};

/** A sidebar entry: a page's path under `docs/<tab>/` without `.mdx`, or a folder of them. */
export type GuideItem = string | GuideFolder;

/** A sidebar section under a heading. */
export type GuideGroup = {
	label: string;
	items: GuideItem[];
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
		label: 'User Guide',
		groups: [
			{
				label: 'User Guide',
				items: [
					'overview',
					'installing',
					'updating',
					{
						label: 'Addons',
						icon: 'puzzle-piece',
						slugs: ['marketplace', 'managing-addons', 'fonts'],
					},
					{
						label: 'Settings',
						icon: 'sliders-3',
						slugs: ['settings', 'sync', 'ios-extensions'],
					},
					'troubleshooting',
				],
			},
			{ label: 'More', items: ['privacy', 'roadmap'] },
		],
	},
	developer: {
		tab: 'developer',
		label: 'Developer Guide',
		// Fundamentals first: each section assumes only the sections above it.
		groups: [
			{ label: 'Start Here', items: ['overview', 'concepts'] },
			{
				label: 'Plugin Development',
				items: [
					{
						label: 'Getting Started',
						icon: 'rocket',
						slugs: [
							'getting-started/first-plugin',
							'getting-started/plugin-anatomy',
							'getting-started/lifecycle',
							'getting-started/project-rules',
						],
					},
					{
						label: 'Plugin APIs',
						icon: 'book',
						slugs: [
							'plugins/metro',
							'plugins/patching',
							'plugins/react-patching',
							'plugins/flux',
							'plugins/settings',
							'plugins/i18n',
							'plugins/assets',
							'plugins/commands',
							'plugins/feedback',
							'plugins/ui-thread',
						],
					},
					{
						label: 'Testing',
						icon: 'circle-check',
						slugs: ['testing/writing-tests', 'testing/native-code'],
					},
					{
						label: 'Publishing',
						icon: 'shop',
						slugs: [
							'publishing/manifest',
							'publishing/store-page',
							'publishing/page-icons',
						],
					},
				],
			},
			{
				label: 'Themes and Icons',
				items: [
					{
						label: 'Themes',
						icon: 'paintbrush',
						slugs: ['themes/introduction', 'themes/types', 'themes/backgrounds'],
					},
					'icon-packs/introduction',
				],
			},
			{ label: 'Tools', items: ['tools/cli', 'tools/debugger', 'tools/ai-agents'] },
			{
				label: 'Core Development',
				items: [
					'core/building',
					{
						label: 'The Loader',
						icon: 'microchip',
						slugs: [
							'loader/introduction',
							'loader/ios',
							'loader/android',
							'loader/settings',
						],
					},
				],
			},
		],
		redirects: {
			'addons/introduction': 'concepts',
			'addons/creating': 'getting-started/first-plugin',
			'addons/standards': 'getting-started/project-rules',
			'addons/manifest': 'publishing/manifest',
			'addons/store-page': 'publishing/store-page',
			'addons/page-icons': 'publishing/page-icons',
			'plugins/anatomy': 'getting-started/plugin-anatomy',
			'plugins/introduction': 'getting-started/lifecycle',
			'plugins/testing': 'testing/writing-tests',
			'plugins/testing-native': 'testing/native-code',
			'development/cli': 'tools/cli',
			'development/debugging': 'tools/debugger',
			'development/ai-agents': 'tools/ai-agents',
			'development/local-builds': 'core/building',
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
	return GUIDE_NAV[tab].groups.flatMap((group) =>
		group.items.flatMap((item) => (typeof item === 'string' ? item : item.slugs)),
	);
}

export default { GUIDE_NAV, getGuideSlugs };
