import type { FluxGuildMember } from '@unbound-app/api/flux';

import { GuildMemberStore, UserProfileStore, UserStore, type IconUtils } from '~/lib/modules';
import type { OpenedSheet } from '~/lib/opened-sheet';
import { AVATAR_SIZE, BANNER_SIZE } from '~/lib/constants';

/** Discord's image URL helpers, once a feature checked they exist. */
export type Icons = NonNullable<typeof IconUtils>;

export type User = {
	id: string;
	avatar?: string | null;
	banner?: string | null;
};

export type Guild = {
	id: string;
	icon?: string | null;
	banner?: string | null;
};

export type Channel = {
	id: string;
	icon?: string | null;
};

type Member = FluxGuildMember & {
	avatar?: string | null;
};

type ImageSize = {
	width: number;
	height: number;
};

/** What an image shows, which names its row in the user's language. */
export type ImageKind =
	| 'avatar'
	| 'banner'
	| 'serverAvatar'
	| 'serverIcon'
	| 'serverBanner'
	| 'groupIcon';

/** An image the user can open, with the size to show while its real size is unknown. */
export type ImageTarget = {
	kind: ImageKind;
	url: string;
	size: ImageSize;
};

type Candidate = {
	kind: ImageKind;
	url: string | null | undefined;
	size: ImageSize;
};

function toTargets(candidates: Candidate[]): ImageTarget[] {
	return candidates.filter((candidate): candidate is ImageTarget => Boolean(candidate.url));
}

/**
 * @description Lists a user's avatar, banner and, inside a guild, their server avatar.
 * @param icons Discord's image URL helpers.
 * @param userId The user's ID.
 * @param guildId The guild the user is viewed in, for the server profile and avatar.
 * @returns The images the user has set, or none when the user is not cached.
 */
export function getUserTargets(icons: Icons, userId: string, guildId?: string): ImageTarget[] {
	const user: User | undefined = UserStore.getUser(userId);

	if (!user) return [];

	const profile =
		(guildId ? UserProfileStore.getGuildMemberProfile(userId, guildId) : null) ??
		UserProfileStore.getUserProfile(userId);
	const merged = profile ? { ...user, ...profile } : user;
	const member: Member | null = guildId ? GuildMemberStore.getMember(guildId, userId) : null;
	const memberAvatar = member?.avatar;
	const serverAvatar =
		guildId && memberAvatar
			? icons.getGuildMemberAvatarURLSimple({
					userId,
					avatar: memberAvatar,
					guildId,
					canAnimate: true,
				})
			: null;

	return toTargets([
		{ kind: 'avatar', url: icons.getUserAvatarURL(merged, true), size: AVATAR_SIZE },
		{ kind: 'banner', url: icons.getUserBannerURL(merged, true), size: BANNER_SIZE },
		{ kind: 'serverAvatar', url: serverAvatar, size: AVATAR_SIZE },
	]);
}

/**
 * @description Lists a guild's icon and banner.
 * @param icons Discord's image URL helpers.
 * @param guild The guild.
 * @returns The images the guild has set.
 */
export function getGuildTargets(icons: Icons, guild: Guild): ImageTarget[] {
	const { id, icon, banner } = guild;

	return toTargets([
		{
			kind: 'serverIcon',
			url: icon ? icons.getGuildIconURL({ id, icon, canAnimate: true }) : null,
			size: AVATAR_SIZE,
		},
		{
			kind: 'serverBanner',
			url: banner ? icons.getGuildBannerURL(guild, true) : null,
			size: BANNER_SIZE,
		},
	]);
}

/**
 * @description Lists a group DM's icon.
 * @param icons Discord's image URL helpers.
 * @param channel The group DM channel.
 * @returns The icon, when the group has one.
 */
export function getChannelTargets(icons: Icons, channel: Channel): ImageTarget[] {
	return toTargets([
		{
			kind: 'groupIcon',
			url: channel.icon ? icons.getChannelIconURL(channel) : null,
			size: AVATAR_SIZE,
		},
	]);
}

/**
 * @description Lists the images of whatever the last opened profile or guild sheet shows.
 * @param icons Discord's image URL helpers.
 * @param sheet The last opened sheet.
 * @returns The sheet's images, or none when no supported sheet was opened.
 */
export function getSheetTargets(icons: Icons, sheet: OpenedSheet | null): ImageTarget[] {
	if (!sheet) return [];

	return sheet.kind === 'guild'
		? getGuildTargets(icons, sheet.guild)
		: getUserTargets(icons, sheet.userId, sheet.guildId);
}

export default { getUserTargets, getGuildTargets, getChannelTargets, getSheetTargets };
