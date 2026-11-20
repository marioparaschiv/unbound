type EmbedImage = { placeholder?: string | null; url?: string | null };

/** The parts of a message embed that can show an image. */
export type EmbedLike = {
	image?: EmbedImage | null;
	thumbnail?: EmbedImage | null;
	images?: EmbedImage[] | null;
};

/** The parts of a message Night Images reads for embeds. */
export type MessageLike = { id?: string; embeds?: EmbedLike[] | null };

function imagesOf(embed: EmbedLike): EmbedImage[] {
	return [embed.image, embed.thumbnail, ...(embed.images ?? [])].filter(
		(image): image is EmbedImage => Boolean(image?.url),
	);
}

/**
 * @description Lists the messages that show a bright embed image.
 * @param messages The loaded messages.
 * @param isBright Whether a placeholder is bright enough to dim.
 * @returns The ids of the messages to dim.
 */
export function brightEmbedMessages(
	messages: readonly MessageLike[],
	isBright: (placeholder: string | null | undefined) => boolean,
): string[] {
	return messages.flatMap((message) =>
		message.id &&
		message.embeds?.some((embed) =>
			imagesOf(embed).some((image) => isBright(image.placeholder)),
		)
			? [message.id]
			: [],
	);
}
