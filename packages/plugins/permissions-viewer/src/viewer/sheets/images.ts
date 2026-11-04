export type IconRole = {
	id: string;
	icon?: string | null;
	unicodeEmoji?: string | null;
};

export type RoleIcon = { kind: 'image'; uri: string } | { kind: 'emoji'; emoji: string };

/**
 * @description Picks what to draw for a role's icon: its uploaded image from Discord's CDN, or its emoji.
 * @param role The role.
 * @param size The size to request, in pixels.
 * @returns The icon, or `undefined` for a role without one.
 */
export function roleIcon(role: IconRole, size: number): RoleIcon | undefined {
	if (role.icon) {
		return {
			kind: 'image',
			uri: `https://cdn.discordapp.com/role-icons/${role.id}/${role.icon}.png?size=${size}`,
		};
	}

	return role.unicodeEmoji ? { kind: 'emoji', emoji: role.unicodeEmoji } : undefined;
}

/**
 * @description Builds the CDN address of a user's avatar, or the default avatar for their ID.
 * @param user The user's ID and avatar hash.
 * @param size The size to request, in pixels.
 * @returns The address.
 */
export function avatarUrl(user: { id: string; avatar?: string | null }, size: number): string {
	if (user.avatar) {
		return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${size}`;
	}

	const index = /^\d+$/.test(user.id) ? (BigInt(user.id) >> 22n) % 6n : 0n;

	return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
