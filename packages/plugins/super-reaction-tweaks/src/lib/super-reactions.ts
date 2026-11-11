import { DISCORD_PLAYING_LIMIT, NITRO_PREMIUM_TYPE } from '~/lib/constants';

/**
 * @description Says whether a playing limit leaves Discord's own limit in charge.
 * @param limit The playing limit setting, from 0 to Discord's own limit.
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
