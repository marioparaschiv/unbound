export type GroupChannel = { id: string; type: number; name?: string; recipients?: string[] };

export type MutualGroup = { id: string; name: string };

const GROUP_DM = 3;
const MAX_NAMED_RECIPIENTS = 3;

/**
 * @description Finds the group DMs a user is in, newest activity first as Discord sorts them, each named as Discord names it.
 * @param channels The private channels, in Discord's order.
 * @param userId The user.
 * @param nameOf Names another member of a group.
 * @returns The shared groups.
 */
export function mutualGroups(
	channels: readonly GroupChannel[],
	userId: string,
	nameOf: (userId: string) => string | undefined,
): MutualGroup[] {
	return channels
		.filter((channel) => channel.type === GROUP_DM && channel.recipients?.includes(userId))
		.map((channel) => ({ id: channel.id, name: groupName(channel, nameOf) }));
}

function groupName(channel: GroupChannel, nameOf: (userId: string) => string | undefined): string {
	if (channel.name) return channel.name;

	const names = (channel.recipients ?? []).flatMap((id) => nameOf(id) ?? []);
	const shown = names.slice(0, MAX_NAMED_RECIPIENTS).join(', ');
	const more = names.length - MAX_NAMED_RECIPIENTS;

	return more > 0 ? `${shown} +${more}` : shown;
}

export default { mutualGroups };
