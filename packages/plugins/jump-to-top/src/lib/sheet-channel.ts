type SheetProps = { channelId?: unknown; channel?: { id?: unknown } | null };

const CHANNEL_SHEETS = /^(?:Channel(?:LongPress)?ActionSheet|ThreadLongPressActionSheet)(?::|$)/i;

/**
 * @description Reads the channel or thread a long-press sheet is about.
 * @param key The action sheet's key.
 * @param props The props Discord opened it with.
 * @returns The channel's id, or `undefined` for any other sheet.
 */
export function sheetChannelId(key: string, props: SheetProps | undefined): string | undefined {
	if (!CHANNEL_SHEETS.test(key)) return;

	const id = props?.channel?.id ?? props?.channelId;

	return typeof id === 'string' && /^\d{17,20}$/.test(id) ? id : undefined;
}
