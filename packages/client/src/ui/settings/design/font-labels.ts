import { format } from '~/i18n/api';

// Discord's groups by what they draw; an unknown group shows its own name.
const GROUPS: Record<string, string> = {
	PRIMARY: 'UNBOUND_FONTS_GROUP_PRIMARY',
	DISPLAY: 'UNBOUND_FONTS_GROUP_DISPLAY',
	CODE: 'UNBOUND_FONTS_GROUP_CODE',
	GINTO: 'UNBOUND_FONTS_GROUP_GINTO',
};

/**
 * @description Names a Discord font group by what it draws, such as Body for `PRIMARY`.
 * @param group The group.
 * @returns The name, or the group itself when Discord adds one Unbound has no name for.
 */
export function groupLabel(group: string): string {
	const key = GROUPS[group];

	return key ? format(key) : group;
}

/**
 * @description Says where a Discord font group shows.
 * @param group The group.
 * @returns The hint, or `undefined` for an unknown group.
 */
export function groupHint(group: string): string | undefined {
	const key = GROUPS[group];

	return key ? format(`${key}_HINT`) : undefined;
}

/**
 * @description Names a weight and style the way type foundries do, such as Semibold Italic.
 * @param weight The weight, 1 to 1000; the nearest hundred is named.
 * @param italic Whether the style is italic.
 * @returns The name.
 */
export function weightLabel(weight: number, italic = false): string {
	const hundred = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
	const name = format(`UNBOUND_FONTS_WEIGHT_${hundred}`);

	return italic ? format('UNBOUND_FONTS_WEIGHT_ITALIC', { weight: name }) : name;
}
