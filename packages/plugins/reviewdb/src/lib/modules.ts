import { flux, metro } from '@unbound-app/api';

export const RelationshipStore = flux.getStore('Relationship');
export const UserStore = flux.getStore('User');

type DisplayProfile = { getPreviewThemeColors?: () => number[] | null | undefined };

/**
 * @description Reads the theme colors a profile shows, including ones Fake Profile Themes finds in its bio.
 * @param userId The profile's user.
 * @returns The primary and accent colors, or `undefined` when the profile has none or is not loaded.
 */
export function profileThemeColors(userId: string): number[] | undefined {
	const profile: DisplayProfile | undefined = metro
		.findByProps('getDisplayProfile')
		?.getDisplayProfile?.(userId);

	return profile?.getPreviewThemeColors?.() ?? undefined;
}
