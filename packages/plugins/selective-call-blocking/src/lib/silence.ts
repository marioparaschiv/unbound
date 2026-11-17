const DM = 1;
const GROUP_DM = 3;

export type CallChannel = { id: string; type: number; recipients?: string[] };

export type SilenceRules = { users: ReadonlySet<string>; groups: ReadonlySet<string> };

/**
 * @description Decides whether a call in a channel should stay silent: a DM with a picked user, or a picked group DM.
 * @param channel The call's channel.
 * @param rules The picked users and group DMs.
 * @returns Whether the call should not ring.
 */
export function isSilenced(channel: CallChannel | undefined, rules: SilenceRules): boolean {
	if (channel?.type === GROUP_DM) return rules.groups.has(channel.id);
	if (channel?.type !== DM) return false;

	return (channel.recipients ?? []).some((id) => rules.users.has(id));
}

export type CallAction = {
	channelId?: string;
	ongoingRings?: Record<string, unknown>;
	ringing?: string[];
};

/**
 * @description Tells whether a call action rings the current user, in either shape Discord uses.
 * @param action The call action.
 * @param selfId The current user's id.
 * @returns Whether it rings them.
 */
export function ringsSelf(action: CallAction, selfId: string): boolean {
	return Boolean(action.ongoingRings?.[selfId] !== undefined || action.ringing?.includes(selfId));
}

/**
 * @description Takes the current user out of a call action's rings, leaving everyone else ringing.
 * @param action The call action, changed in place.
 * @param selfId The current user's id.
 */
export function stopRingingSelf(action: CallAction, selfId: string): void {
	if (action.ongoingRings) {
		const { [selfId]: _self, ...others } = action.ongoingRings;

		action.ongoingRings = others;
	}

	if (action.ringing) action.ringing = action.ringing.filter((id) => id !== selfId);
}
