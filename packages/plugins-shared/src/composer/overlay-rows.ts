export const COMPOSER_ROW_TOP = -26;
export const COMPOSER_ROW_GAP = 6;
export const SLOWMODE_ROW_HEIGHT = 18;

type SlowmodeChannel = { rateLimitPerUser?: number } | null | undefined;

/**
 * @description Measures how far the slowmode notice pushes rows drawn above the composer.
 * @param channel The open channel.
 * @returns The notice's height when the channel has slowmode, otherwise `0`.
 */
export function slowmodeInset(channel: SlowmodeChannel): number {
	return (channel?.rateLimitPerUser ?? 0) > 0 ? SLOWMODE_ROW_HEIGHT : 0;
}

/**
 * @description Places a row above the composer without growing it, stacked over the rows below it.
 * @param channel The open channel, whose slowmode notice the row clears.
 * @param below The total height of the rows already drawn under this one, `0` for the first row.
 * @returns The row's `top` relative to the composer container.
 */
export function composerRowTop(channel: SlowmodeChannel, below = 0): number {
	return COMPOSER_ROW_TOP - below - slowmodeInset(channel);
}
