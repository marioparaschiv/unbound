import { flux, metro } from '@unbound-app/api';

export const TypingStore = flux.getStore('Typing');
export const UserStore = flux.getStore('User');

// Optional: without them, the indicator skips the filter or detail they provide.
export const RelationshipStore = flux.getStore('Relationship');
export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const UserGuildSettingsStore = flux.getStore('UserGuildSettings');
export const GuildMemberStore = flux.getStore('GuildMember');

export const TextChannel = metro.findByFilePath(
	'modules/channel_list_v2/native/items/TextChannel.tsx',
	{ interop: false },
);
export const ThreadChannel = metro.findByFilePath(
	'modules/channel_list_v2/native/items/ThreadChannel.tsx',
	{ interop: false },
);
export const UserSummaryItem = metro.findByFilePath(
	'components_native/common/UserSummaryItem.tsx',
	{ interop: false },
);
export const UserSummaryItemByName = metro.findByName('UserSummaryItem', { interop: false });
export const UserProfileActionSheet = metro.findByFilePath(
	'modules/user_profile/native/UserProfileActionSheet.tsx',
	{ interop: false },
);

export const Tooltips = metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions');
export const Icons = metro.findByProps('UserIcon');
export const ActionSheets = metro.findByProps('openLazy', 'hideActionSheet');
