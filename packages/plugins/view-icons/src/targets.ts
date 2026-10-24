import { GuildMemberStore, IconUtils, UserProfileStore, UserStore } from '~/modules';
import type { OpenedSheet } from '~/opened-sheet';
import { AVATAR_SIZE, BANNER_SIZE } from '~/constants';

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

type ImageSize = {
	width: number;
	height: number;
};

/** An image the user can open, with the size to show while its real size is unknown. */
export type ImageTarget = {
	label: string;
	url: string;
	size: ImageSize;
};

type Candidate = {
	label: string;
	url: string | null | undefined;
	size: ImageSize;
};

function toTargets(candidates: Candidate[]): ImageTarget[] {
	return candidates.filter((candidate): candidate is ImageTarget => Boolean(candidate.url));
}

/**
 * @description Lists a user's avatar, banner and, inside a guild, their server avatar.
 * @param userId The user's ID.
 * @param guildId The guild the user is viewed in, for the server profile and avatar.
 * @returns The images the user has set, or none when the user is not cached.
 */
export function getUserTargets(userId: string, guildId?: string): ImageTarget[] {
	const user: User | undefined = UserStore.getUser(userId);

	if (!user) return [];

	const profile =
		(guildId ? UserProfileStore.getGuildMemberProfile(userId, guildId) : null) ??
		UserProfileStore.getUserProfile(userId);
	const merged = profile ? { ...user, ...profile } : user;
	const memberAvatar = guildId ? GuildMemberStore.getMember(guildId, userId)?.avatar : null;
	const serverAvatar =
		guildId && memberAvatar
			? IconUtils.getGuildMemberAvatarURLSimple({
					userId,
					avatar: memberAvatar,
					guildId,
					canAnimate: true,
				})
			: null;

	return toTargets([
		{ label: 'Avatar', url: IconUtils.getUserAvatarURL(merged, true), size: AVATAR_SIZE },
		{ label: 'Banner', url: IconUtils.getUserBannerURL(merged, true), size: BANNER_SIZE },
		{ label: 'Server Avatar', url: serverAvatar, size: AVATAR_SIZE },
	]);
}

/**
 * @description Lists a guild's icon and banner.
 * @param guild The guild.
 * @returns The images the guild has set.
 */
export function getGuildTargets(guild: Guild): ImageTarget[] {
	const { id, icon, banner } = guild;

	return toTargets([
		{
			label: 'Server Icon',
			url: icon ? IconUtils.getGuildIconURL({ id, icon, canAnimate: true }) : null,
			size: AVATAR_SIZE,
		},
		{
			label: 'Server Banner',
			url: banner ? IconUtils.getGuildBannerURL(guild, true) : null,
			size: BANNER_SIZE,
		},
	]);
}

/**
 * @description Lists a group DM's icon.
 * @param channel The group DM channel.
 * @returns The icon, when the group has one.
 */
export function getChannelTargets(channel: Channel): ImageTarget[] {
	return toTargets([
		{
			label: 'Group DM Icon',
			url: channel.icon ? IconUtils.getChannelIconURL(channel) : null,
			size: AVATAR_SIZE,
		},
	]);
}

/**
 * @description Lists the images of whatever the last opened profile or guild sheet shows.
 * @param sheet The last opened sheet.
 * @returns The sheet's images, or none when no supported sheet was opened.
 */
export function getSheetTargets(sheet: OpenedSheet | null): ImageTarget[] {
	if (!sheet) return [];

	return sheet.kind === 'guild'
		? getGuildTargets(sheet.guild)
		: getUserTargets(sheet.userId, sheet.guildId);
}

export default { getUserTargets, getGuildTargets, getChannelTargets, getSheetTargets };
