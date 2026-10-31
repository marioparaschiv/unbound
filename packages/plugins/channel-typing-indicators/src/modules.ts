import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { metro, flux } from '@unbound-app/api';

export const TypingStore = flux.getStore('Typing', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });

// Optional: without them, the indicator skips the filter or detail they provide.
export const RelationshipStore = flux.getStore('Relationship', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });
export const UserGuildSettingsStore = flux.getStore('UserGuildSettings', { lazy: true });
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });

export const TypingStoreFilter = metro.filters.byFluxStore('Typing');
export const UserStoreFilter = metro.filters.byFluxStore('User');

export const TextChannelPath = 'modules/channel_list_v2/native/items/TextChannel.tsx';
export const ThreadChannelPath = 'modules/channel_list_v2/native/items/ThreadChannel.tsx';

export const TextChannel = metro.findByFilePath(TextChannelPath, { interop: false, lazy: true });
export const ThreadChannel = metro.findByFilePath(ThreadChannelPath, {
	interop: false,
	lazy: true,
});
export const UserSummaryItem = metro.findByFilePath(
	'components_native/common/UserSummaryItem.tsx',
	{ interop: false, lazy: true },
);
export const UserSummaryItemByName = metro.findByName('UserSummaryItem', {
	interop: false,
	lazy: true,
});
export const UserProfileActionSheet = metro.findByFilePath(
	'modules/user_profile/native/UserProfileActionSheet.tsx',
	{ interop: false, lazy: true },
);

export const Tooltips = metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions', {
	lazy: true,
});
export const Icons = metro.findByProps('UserIcon', { lazy: true });
export const ActionSheets = metro.api.ActionSheets;
// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });

export const IndicatorsRunning = createRunningFlag(addon.id);
