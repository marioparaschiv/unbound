import type { AnimateArgument } from '~/lib/arguments';

export const AVATAR_UTILS_PATH = 'utils/AvatarUtils.tsx';
export const GUILD_RECORD_PATH = 'records/GuildRecord.tsx';
export const USER_SETTINGS_PATH = 'modules/user_settings/UserSettings.tsx';
export const STICKERS_UTILS_PATH = 'modules/stickers/StickersUtils.tsx';

export const ALWAYS_ANIMATE_STICKERS = 0;

export const AVATAR_ARGUMENTS: readonly AnimateArgument[] = [
	{ method: 'getUserAvatarURL', index: 1 },
	{ method: 'getUserAvatarSource', index: 1 },
	{ method: 'getGuildMemberAvatarURL', index: 1 },
	{ method: 'getGuildMemberAvatarURLSimple', index: 0, field: 'canAnimate' },
	{ method: 'getUserBannerURL', index: 0, field: 'canAnimate' },
	{ method: 'getGuildMemberBannerURL', index: 0, field: 'canAnimate' },
	{ method: 'getAnimatableSourceWithFallback', index: 0 },
];

export const DECORATION_ARGUMENTS: readonly AnimateArgument[] = [
	{ method: 'getAvatarDecorationURL', index: 0, field: 'canAnimate' },
];

export const SERVER_ARGUMENTS: readonly AnimateArgument[] = [
	{ method: 'getGuildIconURL', index: 0, field: 'canAnimate' },
	{ method: 'getGuildIconSource', index: 0, field: 'canAnimate' },
	{ method: 'getGuildBannerURL', index: 1 },
	{ method: 'getGuildBannerSource', index: 1 },
];

export const GUILD_RECORD_ARGUMENTS: readonly AnimateArgument[] = [
	{ method: 'getGuildIconURL', index: 2 },
	{ method: 'getGuildIconSource', index: 2 },
];
