import type { AnimateArgument } from '~/force/arguments';

export const PLUGIN_NAME = 'Always Animate';

export const AVATAR_UTILS_PATH = 'utils/AvatarUtils.tsx';
export const GUILD_RECORD_PATH = 'records/GuildRecord.tsx';
export const USER_SETTINGS_PATH = 'modules/user_settings/UserSettings.tsx';
export const STICKERS_UTILS_PATH = 'modules/stickers/StickersUtils.tsx';

export const AVATAR_PATH = 'design/void/Avatar/native/Avatar.tsx';
export const CUTOUTABLE_AVATAR_IMAGE_PATH =
	'design/void/CutoutableAvatarImage/native/CutoutableAvatarImage.tsx';
export const AVATAR_DECORATION_PATH =
	'modules/collectibles/native/components/CutoutableAvatarDecoration.tsx';
export const NAMEPLATE_PATH = 'modules/collectibles/nameplates/native/Nameplate.tsx';
export const GUILD_ICON_PATH = 'modules/guild/native/GuildIcon.tsx';
export const GROUP_DM_AVATAR_PATH = 'modules/group_dm/native/GroupDMAvatar.tsx';
export const ACTIVITY_EMOJI_PATH = 'modules/activity_status/native/ActivityEmoji.tsx';
export const PROFILE_EFFECT_LAYER_PATH =
	'modules/collectibles/profile_effects/native/ProfileEffectLayer.ios.tsx';

export const ALWAYS_ANIMATE_STICKERS = 0;

export const SETTINGS = {
	avatars: true,
	decorations: true,
	nameplates: true,
	profileEffects: true,
	servers: true,
	emojis: true,
	stickers: true,
	gifs: true,
} as const;

export type SettingKey = keyof typeof SETTINGS;

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
