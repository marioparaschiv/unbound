import type { Board } from '~/lib/boards';

type EmbedMedia = { url: string; proxy_url: string; width: number; height: number };

export type MessageEmbed = { type?: string; url?: string; thumbnail?: EmbedMedia };

/**
 * @description Builds the image embed Discord shows for a board, loaded straight from lichess.
 * @param board The board.
 * @returns The embed.
 */
export function boardEmbed({ url, width, height }: Board): MessageEmbed {
	return { type: 'image', url, thumbnail: { url, proxy_url: url, width, height } };
}

/**
 * @description Adds an embed for each board the message's embeds do not already show.
 * @param embeds The message's embeds.
 * @param boards The boards found in its content.
 * @returns The embeds with the boards after them.
 */
export function withBoards(embeds: MessageEmbed[], boards: Board[]): MessageEmbed[] {
	const shown = new Set(embeds.map((embed) => embed.url));

	return [...embeds, ...boards.filter((board) => !shown.has(board.url)).map(boardEmbed)];
}
