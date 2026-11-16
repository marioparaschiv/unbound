export type ChannelMessage = { id: string };

export type Region = { x: number; y: number; width: number; height: number };

/**
 * @description Picks the pressed message and the ones right after it in the channel.
 * @param messages The channel's loaded messages, oldest first.
 * @param messageId The pressed message.
 * @param count How many messages to include, the pressed one first.
 * @returns Their ids, oldest first; just the pressed one when the channel doesn't hold it.
 */
export function pickMessages(
	messages: readonly ChannelMessage[],
	messageId: string,
	count: number,
): string[] {
	const start = messages.findIndex(({ id }) => id === messageId);

	if (start === -1) return [messageId];

	return messages.slice(start, start + Math.max(1, count)).map(({ id }) => id);
}

/**
 * @description Joins the on-screen frames of the rows to capture into one region, clipped to the visible chat area.
 * @param frames Each row's frame, in screen points.
 * @param clip The part of the screen the chat shows uncovered, in the same coordinates.
 * @returns The region, or `undefined` when no row has any part in it.
 */
export function captureRegion(frames: readonly Region[], clip: Region): Region | undefined {
	const visible = frames.filter(({ height, width }) => height > 0 && width > 0);

	if (!visible.length) return undefined;

	const left = Math.max(clip.x, Math.min(...visible.map(({ x }) => x)));
	const top = Math.max(clip.y, Math.min(...visible.map(({ y }) => y)));
	const right = Math.min(
		clip.x + clip.width,
		Math.max(...visible.map(({ x, width }) => x + width)),
	);
	const bottom = Math.min(
		clip.y + clip.height,
		Math.max(...visible.map(({ y, height }) => y + height)),
	);

	return right > left && bottom > top
		? { x: left, y: top, width: right - left, height: bottom - top }
		: undefined;
}

export default { pickMessages, captureRegion };
