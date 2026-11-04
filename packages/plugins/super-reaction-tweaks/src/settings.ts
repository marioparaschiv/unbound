import { DISCORD_PLAYING_LIMIT, NITRO_PREMIUM_TYPE } from '~/constants';

/**
 * @description Reads the stored Super Reaction playing limit as a whole number Discord can enforce.
 * @param stored The stored value, which may be missing or out of range.
 * @returns A whole number from 0 to Discord's own limit; Discord's limit when the value is missing or not a number.
 */
export function playingLimit(stored: unknown): number {
	if (typeof stored !== 'number' || !Number.isFinite(stored)) return DISCORD_PLAYING_LIMIT;

	return Math.min(DISCORD_PLAYING_LIMIT, Math.max(0, Math.round(stored)));
}

/**
 * @description Says whether a playing limit leaves Discord's own limit in charge.
 * @param limit A limit from {@link playingLimit}.
 * @returns `true` when the plugin has nothing to cap.
 */
export function isDiscordLimit(limit: number): boolean {
	return limit >= DISCORD_PLAYING_LIMIT;
}

/**
 * @description Says whether a user can send Super Reactions, so the picker is only switched to them for Nitro users.
 * Nitro Basic and Nitro Classic do not include Super Reactions, and switching to them would open Discord's upsell.
 * @param premiumType The user's Nitro tier; `2` is Nitro.
 * @returns `true` only for Nitro.
 */
export function canSuperReact(premiumType: unknown): boolean {
	return premiumType === NITRO_PREMIUM_TYPE;
}
