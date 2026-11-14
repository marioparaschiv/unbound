import type { Clip } from '~/lib/clips';

/** An embed of a chat row, as far as the plugin reads and changes it. */
export type RowEmbed = {
	type?: string;
	url?: string;
	audio?: { url: string; proxyURL: string; contentType: string; description: string };
};

/**
 * @description Turns a row's link embed into an audio embed, so Discord draws its own audio player in it.
 * @param embed The embed, changed in place.
 * @param clip The clip it plays.
 * @param label The player's second line, under the song title.
 */
export function playInEmbed(embed: RowEmbed, clip: Clip, label: string): void {
	embed.type = 'audio';
	embed.audio = {
		url: clip.url,
		proxyURL: clip.url,
		contentType: clip.contentType,
		description: label,
	};
}
