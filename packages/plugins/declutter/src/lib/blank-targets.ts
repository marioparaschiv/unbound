import type { ModuleSelector } from '~/lib/when-loaded';

/** A Declutter option that blanks what a Discord module returns: a hook, a helper or a component's render. */
export type BlankTarget = {
	/** The setting that turns it on. */
	setting: BlankSetting;
	/** Where the module lives. */
	module: ModuleSelector;
	/** The exports to blank; `default` for a module's default export. */
	methods: string[];
	/** What they return instead. */
	value: null | false | 0 | readonly never[];
	/** Patch the export as a component, through its memo or forwardRef render. */
	component?: boolean;
};

export type BlankSetting =
	| 'avatarDecorations'
	| 'nameplates'
	| 'profileEffects'
	| 'profileFrames'
	| 'badges'
	| 'serverTags'
	| 'displayNameStyles'
	| 'serverThemes'
	| 'dmActivityCards'
	| 'questDock'
	| 'orbsBalance';

/** Every module Declutter blanks, keyed by the setting that turns it on. Ported from Benjii's Declutter for Revenge. */
export const BLANK_TARGETS: readonly BlankTarget[] = [
	{
		setting: 'avatarDecorations',
		module: { path: 'modules/collectibles/avatar_decorations/useAvatarDecoration.tsx' },
		methods: ['useAvatarDecoration', 'getAvatarDecoration'],
		value: null,
	},
	{
		setting: 'avatarDecorations',
		module: { path: 'modules/collectibles/avatar_decorations/AvatarDecorationUtils.tsx' },
		methods: ['parseAvatarDecorationData'],
		value: null,
	},
	{
		setting: 'nameplates',
		module: { props: ['useNameplate'] },
		methods: ['useNameplate'],
		value: null,
	},
	{
		setting: 'nameplates',
		module: { name: 'Nameplate' },
		methods: ['default'],
		value: null,
		component: true,
	},
	{
		setting: 'profileEffects',
		module: { name: 'useProfileEffect' },
		methods: ['default'],
		value: null,
	},
	{
		setting: 'profileEffects',
		module: { name: 'WrappedProfileEffect' },
		methods: ['default'],
		value: null,
		component: true,
	},
	{
		setting: 'profileFrames',
		module: { name: 'useProfileFrame' },
		methods: ['default'],
		value: null,
	},
	{ setting: 'badges', module: { name: 'useBadges' }, methods: ['default'], value: [] },
	{
		setting: 'serverTags',
		module: { path: 'modules/guild_tag/GuildTagUtils.tsx' },
		methods: ['useShouldDisplayGuildTag', 'shouldDisplayGuildTag'],
		value: false,
	},
	{
		setting: 'serverTags',
		module: { path: 'modules/guild_tag/native/GuildTag.tsx' },
		methods: ['default', 'GuildTagBadge', 'BaseGuildTagChiplet'],
		value: null,
		component: true,
	},
	{
		setting: 'serverTags',
		module: { path: 'modules/guild_tag/native/VoiceGuildTag.tsx' },
		methods: ['default'],
		value: null,
		component: true,
	},
	{
		setting: 'displayNameStyles',
		module: { name: 'useDisplayNameStyles' },
		methods: ['default'],
		value: null,
	},
	{
		setting: 'serverThemes',
		module: { path: 'modules/premium/powerups/experiments/ServerThemeUserExperiment.tsx' },
		methods: ['getServerThemeUserEnabled', 'useServerThemeUserEnabled'],
		value: false,
	},
	{
		setting: 'dmActivityCards',
		module: {
			path: 'modules/main_tabs_v2/native/tabs/messages/items/MessagesItemHappeningNow.tsx',
		},
		methods: ['getMessagesItemHappeningNowHeight'],
		value: 0,
	},
	{
		setting: 'dmActivityCards',
		module: {
			path: 'modules/main_tabs_v2/native/tabs/messages/items/MessagesItemHappeningNow.tsx',
		},
		methods: ['default'],
		value: null,
		component: true,
	},
	{
		setting: 'questDock',
		module: { path: 'modules/quests/native/QuestDock/QuestDock.tsx' },
		methods: ['default'],
		value: null,
		component: true,
	},
	{
		setting: 'orbsBalance',
		module: { path: 'modules/virtual_currency/native/BalanceWidgetMenu.tsx' },
		methods: ['default'],
		value: null,
		component: true,
	},
];

export default BLANK_TARGETS;
