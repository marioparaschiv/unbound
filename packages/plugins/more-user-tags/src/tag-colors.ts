import {
	getRoleColorAppearance,
	type RoleColorAppearance,
	type RoleColorStops,
} from '@unbound-plugins/shared/colors/role-colors';

export type ColorSource = { colorString?: string; colorStrings?: RoleColorStops };

export type TagColorOptions = {
	useRoleColor: boolean;
	useEnhancedRoleColors: boolean;
	coloredTags: boolean;
};

/**
 * @description Picks a tag's colors: the first role color found in `sources`, else the tag's own color.
 * @param tagColor The tag's own color.
 * @param sources Places to read a role color from, in priority order (the guild member, then the message).
 * @param options The plugin's appearance settings.
 * @returns The colors and style to draw the tag with; no colors means Discord's default styling.
 */
export function resolveTagColors(
	tagColor: string,
	sources: (ColorSource | undefined)[],
	options: TagColorOptions,
): RoleColorAppearance {
	if (options.useRoleColor) {
		for (const source of sources) {
			const appearance = getRoleColorAppearance(
				source?.colorStrings,
				source?.colorString,
				options.useEnhancedRoleColors,
			);

			if (appearance.colors.length > 0) return appearance;
		}
	}

	return { colors: options.coloredTags ? [tagColor] : [], style: 'solid' };
}

export default { resolveTagColors };
