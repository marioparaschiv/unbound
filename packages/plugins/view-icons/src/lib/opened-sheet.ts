import { asId } from '@unbound-plugins/shared/values/as-id';

import type { Guild } from '~/lib/targets';

export type OpenedSheet =
	| { kind: 'profile'; userId: string; guildId?: string }
	| { kind: 'guild'; guild: Guild };

/** The last profile or guild action sheet opened, read by both patches. */
export type SheetRef = {
	current: OpenedSheet | null;
};

/** The last profile or guild action sheet opened, recorded by the action sheet patch for menus opened inside it. */
export const openedSheet: SheetRef = { current: null };

export type SheetProps = {
	userId?: unknown;
	guildId?: unknown;
	guild?: unknown;
};

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

export default { toOpenedSheet };
