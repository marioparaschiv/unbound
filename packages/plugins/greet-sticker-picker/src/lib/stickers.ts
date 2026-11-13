const MAX_STICKERS = 64;

export type GreetSticker = { id: string; name: string; description?: string; format_type?: number };

/**
 * @description Lists the stickers Discord greets new members with, in its own order. Discord keeps the list private and
 * picks one by the message's timestamp, so stepping the timestamp one millisecond at a time walks the whole list once.
 * @template T The kind of sticker.
 * @param pick Discord's `pickWelcomeSticker`, which takes a message id.
 * @returns Each sticker once.
 */
export function greetStickers<T extends { id: string }>(
	pick: (messageId: string) => T | undefined,
): T[] {
	const stickers: T[] = [];

	for (let step = 0; step < MAX_STICKERS; step++) {
		const sticker = pick(String(BigInt(step) << 22n));

		if (!sticker || sticker.id === stickers[0]?.id) break;

		stickers.push(sticker);
	}

	return stickers;
}
