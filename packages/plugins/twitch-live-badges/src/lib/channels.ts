const CHANNEL_LINK = /https?:\/\/(?:www\.|m\.)?twitch\.tv\/([A-Za-z0-9_]{3,25})(?=[/?#\s>)]|$)/g;
const RESERVED = new Set([
	'directory',
	'downloads',
	'jobs',
	'p',
	'search',
	'settings',
	'subscriptions',
	'turbo',
	'videos',
	'wallet',
	'inventory',
	'drops',
]);

/**
 * @description Finds the Twitch channels a message links to.
 * @param content The message's text.
 * @returns Each linked channel once, in lowercase.
 */
export function twitchChannels(content: string): string[] {
	const found = [...content.matchAll(CHANNEL_LINK)].map(([, channel]) => channel!.toLowerCase());

	return [...new Set(found)].filter((channel) => !RESERVED.has(channel));
}

/**
 * @description Reads the channel an embed's link points at.
 * @param url The embed's URL.
 * @returns The channel in lowercase, or `undefined` when it is not a channel link.
 */
export function embedChannel(url: string | undefined): string | undefined {
	return url ? twitchChannels(url)[0] : undefined;
}

export default { twitchChannels, embedChannel };
