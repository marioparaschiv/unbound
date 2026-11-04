// `.invalid` is reserved (RFC 2606), so nothing can ever be delivered to these addresses.
const PLACEHOLDER_EMAIL_DOMAIN = 'discord.invalid';

/**
 * @description Builds the email Better Auth stores for a Discord sign-up. Unbound never asks Discord
 * for an email, but Better Auth requires a unique one per user.
 * @param discordId The Discord user id.
 * @returns The undeliverable placeholder address.
 */
export function getPlaceholderEmail(discordId: string): string {
	return `${discordId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export default { getPlaceholderEmail };
