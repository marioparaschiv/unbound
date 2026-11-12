import { flux, metro } from '@unbound-app/api';

import { UserStore } from '~/bubbles/modules';

const AVATAR_SIZE = 128;

type Decoration = { asset?: string; skuId?: string };

type Author = {
	getAvatarURL?(guildId: string | undefined, size: number): string | undefined;
	avatarDecoration?: Decoration | null;
};

const ChannelStore = flux.getStore('Channel');
const GuildMemberStore = flux.getStore('GuildMember');
const Avatars = metro.findByProps('getAvatarDecorationURL') as {
	getAvatarDecorationURL?(options: { avatarDecoration: Decoration; size: number }): string;
};

/**
 * @description Builds an author's avatar and decoration URLs from Discord's stores, for a group's last row when the UI thread never saw the group's first row bound.
 * @param author The author's user id.
 * @param channelId The channel, whose server may give the author its own picture.
 * @returns The URLs, either `undefined` when the stores do not know them.
 */
export function authorPicture(
	author: string,
	channelId: string | undefined,
): { url?: string; decoration?: string } {
	const user = UserStore.getUser?.(author) as Author | undefined;
	const guildId = channelId ? ChannelStore.getChannel?.(channelId)?.guild_id : undefined;
	const member = (guildId ? GuildMemberStore.getMember?.(guildId, author) : undefined) as
		| Pick<Author, 'avatarDecoration'>
		| undefined;
	const decoration = member?.avatarDecoration ?? user?.avatarDecoration;
	const url = user?.getAvatarURL?.(guildId ?? undefined, AVATAR_SIZE);
	const decorationUrl = decoration
		? Avatars.getAvatarDecorationURL?.({ avatarDecoration: decoration, size: AVATAR_SIZE })
		: undefined;

	return {
		...(url ? { url } : {}),
		...(decorationUrl ? { decoration: decorationUrl } : {}),
	};
}

export default { authorPicture };
