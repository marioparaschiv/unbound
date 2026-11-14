import { flux, metro } from '@unbound-app/api';

type Member = { userId: string; roles?: string[] };

type MemberStore = {
	getMembers(guildId: string): Member[];
	getMemberIds(guildId: string): string[];
};

const MAX_REQUESTED = 100;

/**
 * @description Lists the loaded members of a server who have a role.
 * @param guildId The server.
 * @param roleId The role.
 * @returns Their user ids.
 */
export function membersWithRole(guildId: string, roleId: string): string[] {
	const Members = flux.getStore('GuildMember') as unknown as MemberStore;

	return Members.getMembers(guildId)
		.filter((member) => member.roles?.includes(roleId))
		.map((member) => member.userId);
}

/**
 * @description Asks Discord for a server's members over the gateway, so a role's member list fills in.
 * @param guildId The server.
 */
export function requestMembers(guildId: string): void {
	try {
		metro
			.findByProps('requestMembers', 'getGuildNameSuggestion')
			?.requestMembers(guildId, '', MAX_REQUESTED);
	} catch (error) {
		logger.error(`Failed to request the members of ${guildId}:`, error);
	}
}
