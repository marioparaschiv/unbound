/** How often one invite has been used, and who made it; the vanity url has no inviter. */
export type InviteUse = {
	code: string;
	uses: number;
	maxUses: number;
	inviterId?: string;
	vanity?: boolean;
};

/**
 * @description Finds the invite a new member joined with, by comparing invite uses before and after the join.
 * @param before The invites by code, before the join.
 * @param after The invites by code, after it.
 * @returns The invite whose uses rose, one that hit its last use and vanished, or undefined when none or several match.
 */
export function findUsedInvite(
	before: ReadonlyMap<string, InviteUse>,
	after: ReadonlyMap<string, InviteUse>,
): InviteUse | undefined {
	const rose = [...after.values()].filter(
		({ code, uses }) => uses > (before.get(code)?.uses ?? 0),
	);

	if (rose.length) {
		return rose.length === 1 ? rose[0] : undefined;
	}

	// An invite on its last use is deleted by Discord, so it shows only as gone.
	const spent = [...before.values()].filter(
		({ code, uses, maxUses }) => !after.has(code) && maxUses > 0 && uses + 1 >= maxUses,
	);

	return spent.length === 1 ? spent[0] : undefined;
}

export default { findUsedInvite };
