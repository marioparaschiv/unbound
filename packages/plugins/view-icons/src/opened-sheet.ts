import type { Guild } from '~/targets';

export type OpenedSheet =
	| { kind: 'profile'; userId: string; guildId?: string }
	| { kind: 'guild'; guild: Guild };

/** The last profile or guild action sheet opened, read by both patches. */
export type SheetRef = {
	current: OpenedSheet | null;
};

export type SheetProps = {
	userId?: unknown;
	guildId?: unknown;
	guild?: unknown;
};

/**
 * @description Reads an ID Discord passed untyped.
 * @param value A sheet prop or menu field.
 * @returns The ID, or `undefined` unless it is a non-empty string.
 */
// UNKNOWN: sheet props and menu fields come from Discord untyped.
export function asId(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

function isGuild(value: unknown): value is Guild {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Recognizes a user profile or guild action sheet from the arguments Discord opened it with.
 * @param key The action sheet's key.
 * @param props The sheet's props.
 * @returns The profile or guild the sheet shows, `null` for a profile sheet whose user ID is not a string, or `undefined` for any other sheet.
 */
export function toOpenedSheet(key: string, props: SheetProps): OpenedSheet | null | undefined {
	if (/^UserProfile/i.test(key) && props.userId) {
		const userId = asId(props.userId);

		return userId ? { kind: 'profile', userId, guildId: asId(props.guildId) } : null;
	}

	if (/^GuildActionSheet:/i.test(key) && isGuild(props.guild)) {
		return { kind: 'guild', guild: props.guild };
	}
}

export default { asId, toOpenedSheet };
