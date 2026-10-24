import { Guilds, Users } from '~/modules';

export type Guild = {
	id: string;
	name: string;
	icon?: string | null;
	ownerId?: string;
};

/**
 * @description Lists the servers the current user owns, where they can upload emojis and stickers.
 * @returns The owned servers, sorted by name.
 */
export function getOwnedGuilds(): Guild[] {
	const id = Users.getCurrentUser()?.id;

	if (!id) return [];

	const guilds: Guild[] = Object.values(Guilds.getGuilds());

	return guilds
		.filter((guild) => guild.ownerId === id)
		.sort((first, second) => first.name.localeCompare(second.name));
}

/**
 * @description Builds the URL of a server's icon at 64px.
 * @param guild A server that has an icon.
 * @returns The CDN URL.
 */
export function getGuildIconUrl(guild: Guild): string {
	return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`;
}

export default { getOwnedGuilds, getGuildIconUrl };
