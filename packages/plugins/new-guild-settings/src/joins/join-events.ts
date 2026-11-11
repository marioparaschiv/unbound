import { asId } from '@unbound-plugins/shared/values/as-id';

type InviteGuild = { id?: unknown };

export type InviteAcceptAction = {
	invite?: {
		guild?: InviteGuild | null;
		guild_id?: unknown;
		new_member?: unknown;
	} | null;
};

export type JoinRequestAction = {
	guildId?: unknown;
	status?: unknown;
	request?: { user_id?: unknown; userId?: unknown } | null;
};

export type JoinGuildOptions = { lurker?: unknown } | null | undefined;

/**
 * @description Picks the server an accepted invite joined, skipping group DM invites and servers the user was already in.
 * @param action The `INVITE_ACCEPT_SUCCESS` action.
 * @returns The server ID, or `undefined` when there is nothing to apply.
 */
export function inviteGuildId(action: InviteAcceptAction): string | undefined {
	const invite = action.invite;

	if (!invite || invite.new_member === false) return undefined;

	return asId(invite.guild?.id) ?? asId(invite.guild_id);
}

/**
 * @description Picks the server whose join request for the signed-in user was approved.
 * @param action The `GUILD_JOIN_REQUEST_UPDATE` action.
 * @param currentUserId The signed-in user's ID.
 * @returns The server ID, or `undefined` for another user's request or any other status.
 */
export function approvedRequestGuildId(
	action: JoinRequestAction,
	currentUserId: string | undefined,
): string | undefined {
	if (action.status !== 'APPROVED' || !currentUserId) return undefined;

	const userId = asId(action.request?.user_id) ?? asId(action.request?.userId);

	return userId === currentUserId ? asId(action.guildId) : undefined;
}

/**
 * @description Picks the server a `joinGuild` call joined as a full member, as Vencord skips lurking joins.
 * @param guildId The first `joinGuild` argument.
 * @param options The second `joinGuild` argument.
 * @returns The server ID, or `undefined` for a lurking join.
 */
export function memberJoinGuildId(guildId: unknown, options: JoinGuildOptions): string | undefined {
	if (options?.lurker) return undefined;

	return asId(guildId);
}

/**
 * @description Creates a guard that lets each server through once per time window, so one join reported by several paths applies once.
 * @param windowMs How long a server stays blocked after it passes.
 * @param now The clock.
 * @returns A function that returns `true` the first time it sees a server in the window.
 */
export function createRepeatGuard(
	windowMs: number,
	now: () => number = Date.now,
): (guildId: string) => boolean {
	const seen = new Map<string, number>();

	return (guildId) => {
		const time = now();

		for (const [id, at] of seen) {
			if (time - at >= windowMs) seen.delete(id);
		}

		if (seen.has(guildId)) return false;

		seen.set(guildId, time);

		return true;
	};
}

export default { inviteGuildId, approvedRequestGuildId, memberJoinGuildId, createRepeatGuard };
