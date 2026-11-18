export type EmbedImage = { url: string; width: number; height: number };

type EmbedMedia = { url: string; proxy_url: string; width: number; height: number };

export type MessageEmbed = { type?: string; url?: string; thumbnail?: EmbedMedia };

/**
 * @description Builds the image embed Discord shows for an image, loaded straight from its URL.
 * @param image The image.
 * @returns The embed.
 */
export function imageEmbed({ url, width, height }: EmbedImage): MessageEmbed {
	return { type: 'image', url, thumbnail: { url, proxy_url: url, width, height } };
}

/**
 * @description Adds an embed for each image the message's embeds do not already show.
 * @param embeds The message's embeds.
 * @param images The images found in its content.
 * @returns The embeds with the images after them.
 */
export function withImages(embeds: MessageEmbed[], images: EmbedImage[]): MessageEmbed[] {
	const shown = new Set(embeds.map((embed) => embed.url));

	return [...embeds, ...images.filter((image) => !shown.has(image.url)).map(imageEmbed)];
}
