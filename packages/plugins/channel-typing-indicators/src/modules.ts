import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { metro, patcher, storage } from '@unbound-app/api';

export const TypingStore = metro.findStore('Typing', { lazy: true });
export const UserStore = metro.stores.Users;

// Optional: without them, the indicator skips the filter or detail they provide.
export const RelationshipStore = metro.findStore('Relationship', { lazy: true });
export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });
export const UserGuildSettingsStore = metro.findStore('UserGuildSettings', { lazy: true });
export const GuildMemberStore = metro.findStore('GuildMember', { lazy: true });

export const TypingStoreFilter = metro.filters.byStore('Typing');
export const UserStoreFilter = metro.filters.byStore('User');

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

export const settings = storage.getStore('unbound.channel-typing-indicators');
export const Patcher = patcher.createPatcher('unbound.channel-typing-indicators');
export const IndicatorsRunning = createRunningFlag('unbound.channel-typing-indicators');
