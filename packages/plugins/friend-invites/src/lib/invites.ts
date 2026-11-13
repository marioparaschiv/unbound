export type FriendInvite = {
	code: string;
	expires_at?: string | null;
	max_uses?: number;
	uses?: number;
};

function expiry(invite: FriendInvite): string {
	const at = invite.expires_at ? Date.parse(invite.expires_at) : Number.NaN;

	return Number.isFinite(at) ? `<t:${Math.round(at / 1000)}:R>` : 'never';
}

/**
 * @description Describes a new friend invite: its link, when it expires and how often it can be used.
 * @param invite The invite.
 * @returns One line of Markdown.
 */
export function describeCreated(invite: FriendInvite): string {
	return `discord.gg/${invite.code} · Expires: ${expiry(invite)} · Max uses: \`${invite.max_uses ?? '∞'}\``;
}

/**
 * @description Lists friend invites, one per line, with how often each was used.
 * @param invites The invites.
 * @returns The list, or a note that there are none.
 */
export function describeList(invites: FriendInvite[]): string {
	if (!invites.length) return 'You have no active friend invites.';

	return invites
		.map(
			(invite) =>
				`discord.gg/${invite.code} · Expires: ${expiry(invite)} · Used: \`${invite.uses ?? 0}/${invite.max_uses ?? '∞'}\``,
		)
		.join('\n');
}
