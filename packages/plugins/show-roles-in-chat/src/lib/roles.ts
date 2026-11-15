/** What the plugin reads from a role. */
export type Role = { id: string; name: string; color: number; position: number };

/** A role tag's text and its ARGB colours as signed 32-bit integers, which Android's row parser requires. */
export type RoleTag = { text: string; textColor: number; backgroundColor: number };

const OPAQUE = 0xff000000;
const PLAIN_BACKGROUND = 0xff4e5058 | 0;
const WHITE = 0xffffffff | 0;
const BLACK = 0xff000000 | 0;
const LIGHT = 0.6;

/**
 * @description Picks the role to show: the highest one, or the highest with a colour.
 * @param roles The member's roles.
 * @param coloredOnly Whether to skip roles without a colour.
 * @returns The role, or `undefined` when none qualifies.
 */
export function topRole(roles: (Role | undefined)[], coloredOnly: boolean): Role | undefined {
	return roles
		.filter((role): role is Role => Boolean(role?.name) && (!coloredOnly || role!.color > 0))
		.reduce<Role | undefined>(
			(best, role) => (!best || role.position > best.position ? role : best),
			undefined,
		);
}

function luminance(rgb: number): number {
	const channel = (shift: number) => ((rgb >> shift) & 0xff) / 255;

	return 0.299 * channel(16) + 0.587 * channel(8) + 0.114 * channel(0);
}

/**
 * @description Turns a role into a tag: the role's colour as the background, with readable text on it.
 * @param role The role.
 * @returns The tag.
 */
export function roleTag(role: Role): RoleTag {
	const backgroundColor = role.color > 0 ? OPAQUE | role.color : PLAIN_BACKGROUND;
	const textColor = role.color > 0 && luminance(role.color) > LIGHT ? BLACK : WHITE;

	return { text: role.name, textColor, backgroundColor };
}
