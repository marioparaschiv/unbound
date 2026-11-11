import { asId } from '@unbound-plugins/shared/values/as-id';

export type Target =
	| { kind: 'member'; guildId: string; userId: string }
	| { kind: 'channel'; channelId: string }
	| { kind: 'guild'; guildId: string };

export type SheetProps = {
	userId?: unknown;
	guildId?: unknown;
	channelId?: unknown;
	guild?: { id?: unknown } | null;
	channel?: { id?: unknown } | null;
	user?: { id?: unknown } | null;
};

/**
 * @description Recognizes the action sheets that get a View Permissions row: a profile opened from a server, a channel's long-press sheet and a server's sheet.
 * @param key The action sheet's key.
 * @param props The props Discord opened the sheet with.
 * @returns What the sheet is about, or `undefined` for any other sheet.
 */
export function sheetTarget(key: string, props: SheetProps): Target | undefined {
	if (/^UserProfile/i.test(key)) {
		const userId = asId(props.userId) ?? asId(props.user?.id);
		const guildId = asId(props.guildId);

		return userId && guildId ? { kind: 'member', guildId, userId } : undefined;
	}

	if (/^GuildActionSheet:/i.test(key)) {
		const guildId =
			asId(props.guild?.id) ?? asId(props.guildId) ?? asId(key.slice(key.indexOf(':') + 1));

		return guildId ? { kind: 'guild', guildId } : undefined;
	}

	if (/^Channel(?:LongPress)?ActionSheet(?::|$)/i.test(key)) {
		const channelId = asId(props.channel?.id) ?? asId(props.channelId);

		return channelId ? { kind: 'channel', channelId } : undefined;
	}

	return undefined;
}
