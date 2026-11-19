const SOUNDCLOUD = /^https:\/\/(?:www\.|m\.)?soundcloud\.com\/[\w-]+\/(?:sets\/)?[\w-]+/;
const SHORT = /^https:\/\/on\.soundcloud\.com\/\w+/;
const PLAYER = 'https://w.soundcloud.com/player/';

/**
 * @description Reads a SoundCloud track or playlist link, dropping its query.
 * @param url The tapped link.
 * @returns The link to play, or `undefined` for any other link.
 */
export function soundcloudLink(url: string): string | undefined {
	return (SOUNDCLOUD.exec(url) ?? SHORT.exec(url))?.[0];
}

/**
 * @description Builds the address of SoundCloud's embedded player for a track or playlist, starting at once.
 * @param link The SoundCloud link.
 * @returns The player's address.
 */
export function playerUrl(link: string): string {
	return `${PLAYER}?url=${encodeURIComponent(link)}&auto_play=true&visual=true&show_comments=false`;
}

/**
 * @description Tells whether the player may load an address, so its own pages stay in the sheet and links leave it.
 * @param url The address the player navigates to.
 * @returns Whether it stays in the player.
 */
export function staysInPlayer(url: string): boolean {
	return url.startsWith(PLAYER) || url === 'about:blank';
}

export default { soundcloudLink, playerUrl, staysInPlayer };
