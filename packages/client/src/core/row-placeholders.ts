import { isValidThumbHash } from '~/core/thumbhash';

type Placeheld = { placeholder?: string | null };

type RowEmbed = {
	image?: Placeheld | null;
	thumbnail?: Placeheld | null;
	images?: Placeheld[] | null;
};

/** The parts of a chat row's message that carry image placeholders. */
export type RowMessage = {
	id?: string;
	attachments?: Placeheld[] | null;
	embeds?: RowEmbed[] | null;
};

function placeheld(message: RowMessage): Placeheld[] {
	const embedded = (message.embeds ?? []).flatMap((embed) => [
		embed.image,
		embed.thumbnail,
		...(embed.images ?? []),
	]);

	return [...(message.attachments ?? []), ...embedded].filter((item): item is Placeheld =>
		Boolean(item),
	);
}

/**
 * @description Removes the image placeholders a chat row carries that are not complete ThumbHashes, so Discord draws
 * those images without a preview instead of trapping in its native decoder.
 * @param message The row's message.
 * @returns How many placeholders it removed.
 */
export function dropInvalidPlaceholders(message: RowMessage): number {
	let dropped = 0;

	for (const item of placeheld(message)) {
		if (typeof item.placeholder === 'string' && !isValidThumbHash(item.placeholder)) {
			item.placeholder = null;
			dropped++;
		}
	}

	return dropped;
}

export default { dropInvalidPlaceholders };
