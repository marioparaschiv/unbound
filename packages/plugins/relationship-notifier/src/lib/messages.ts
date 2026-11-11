export type NamedUser = {
	username: string;
	discriminator?: string | null;
};

/**
 * @description Names a user uniquely: the username, with the legacy tag for accounts that still have one.
 * @param user The user.
 * @returns `name` for unique usernames, `name#1234` otherwise.
 */
export function uniqueUsername({ username, discriminator }: NamedUser): string {
	return !discriminator || discriminator === '0' ? username : `${username}#${discriminator}`;
}

export const messages = {
	removedFriend: (name: string) => `${name} removed you as a friend.`,
	removedRequest: (name: string) => `A friend request from ${name} has been removed.`,
	removedFromServer: (name: string) => `You were removed from the server ${name}.`,
	removedFromGroup: (name: string) => `You were removed from the group ${name}.`,
	offlineServer: (name: string) => `You are no longer in the server ${name}.`,
	offlineGroup: (name: string) => `You are no longer in the group ${name}.`,
	offlineFriend: (name: string) => `You are no longer friends with ${name}.`,
	offlineRequest: (name: string) => `Friend request from ${name} has been revoked.`,
};
