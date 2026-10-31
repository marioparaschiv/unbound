import { GuildMemberStore, SelectedChannelStore, UserStore } from '~/modules';
import { presentNames, uniqueNames, type NameOwner } from '~/names';
import { longestFirst } from '~/mentions';
import { guildIdOf } from '~/channel-guild';

export type GuildAliases = {
	owners: Map<string, string>;
	names: string[];
};

/**
 * @description Reads the guild of the channel the user has open.
 * @returns The guild id, or `undefined` outside a server.
 */
export function currentGuildId(): string | undefined {
	return guildIdOf(SelectedChannelStore.getChannelId());
}

/**
 * @description Lists every name a guild member can be mentioned by in the composer, which shows a mention as plain `@name` text.
 * @param guildId The guild.
 * @returns Each name's member, and the names longest first so a longer name wins over its prefix.
 */
export function guildAliases(guildId: string): GuildAliases {
	const members = (GuildMemberStore.getMembers(guildId) ?? []).slice(0, 5_000);
	const owners = uniqueNames(
		members.map((member): NameOwner<string> => {
			const user = UserStore.getUser(member.userId);
			const tag =
				user?.username && user.discriminator && user.discriminator !== '0'
					? `${user.username}#${user.discriminator}`
					: null;

			return [
				presentNames(member.nick, user?.globalName, user?.username, tag),
				member.userId,
			];
		}),
	);

	return { owners, names: longestFirst(owners.keys()) };
}

export default { currentGuildId, guildAliases };
