import { metro } from '@unbound-app/api';

import { avatarPngURL, extractMentionTokens, roleImageSource } from '~/mentions';
import { ChannelStore, GuildMemberStore, RoleStore, UserStore } from '~/modules';
import type { Mention, Role } from '~/mentions';

type User = {
	avatar?: string | null;
	getAvatarURL?: (guildId: string | null, size: number, animated: boolean) => unknown;
	globalName?: string | null;
	id: string;
	username?: string;
};

export type Message = {
	channel_id?: string;
	channelId?: string;
	content?: string;
	guild_id?: string;
	guildId?: string;
	id?: string;
};

export type CollectedMentions = {
	complete: boolean;
	mentions: Mention[];
};

function userAvatarURL(user: User, guildId?: string): string | undefined {
	const resolved = user.getAvatarURL?.(guildId ?? null, 32, false);

	if (typeof resolved === 'string' && resolved) return avatarPngURL(resolved);

	if (user.avatar) {
		return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`;
	}

	// Default avatars resolve to a bundled asset ID instead of a URL.
	if (typeof resolved !== 'number') return;

	const uri: string | undefined =
		metro.common.ReactNative.Image.resolveAssetSource(resolved)?.uri;

	if (uri?.startsWith('file:///')) return uri;
}

function userMention(userId: string, guildId?: string): Mention | undefined {
	const user: User | undefined = UserStore.getUser(userId);

	if (!user) return;

	const labels = [
		GuildMemberStore.getMember?.(guildId ?? '', userId)?.nick,
		user.globalName,
		user.username,
	].filter((label): label is string => Boolean(label));

	if (!labels.length) return;

	return { avatarURL: userAvatarURL(user, guildId), labels: [...new Set(labels)], type: 'user' };
}

function roleMention(roleId: string, guildId?: string): Mention | undefined {
	if (!guildId) return;

	const role: Role | undefined =
		RoleStore.getRole(guildId, roleId) ??
		RoleStore.getSortedRoles(guildId)?.find((candidate: Role) => candidate.id === roleId);

	if (!role?.name) return;

	return { ...roleImageSource(role), labels: [role.name], type: 'role' };
}

function guildIdForMessage(message: Message): string | undefined {
	const guildId = message.guild_id ?? message.guildId;

	if (guildId) return guildId;

	const channelId = message.channel_id ?? message.channelId;
	const channel = channelId ? ChannelStore.getChannel?.(channelId) : undefined;

	return channel?.guild_id ?? channel?.guildId;
}

/**
 * @description Resolves each mention in a message to the labels and image it renders with.
 * @param message The Discord message.
 * @param includeRoles Whether role mentions can be resolved; when not, they count as unresolved.
 * @returns The resolved mentions, and whether every mention resolved.
 */
export function collectMentions(message: Message, includeRoles: boolean): CollectedMentions {
	const mentions: Mention[] = [];
	let complete = true;

	if (typeof message.content !== 'string') return { complete, mentions };

	const guildId = guildIdForMessage(message);

	for (const { id, type } of extractMentionTokens(message.content)) {
		const mention =
			type === 'user'
				? userMention(id, guildId)
				: includeRoles
					? roleMention(id, guildId)
					: undefined;

		if (mention) {
			mentions.push(mention);
		} else {
			complete = false;
		}
	}

	return { complete, mentions };
}

export default { collectMentions };
