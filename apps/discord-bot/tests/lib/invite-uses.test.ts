import { describe, expect, test } from 'bun:test';

import { findUsedInvite, type InviteUse } from '~/lib/invite-uses';

const invites = (...list: InviteUse[]) => new Map(list.map((invite) => [invite.code, invite]));

describe('findUsedInvite', () => {
	test('finds the invite whose uses rose', () => {
		const before = invites(
			{ code: 'a', uses: 3, maxUses: 0 },
			{ code: 'b', uses: 1, maxUses: 0 },
		);
		const after = invites(
			{ code: 'a', uses: 3, maxUses: 0 },
			{ code: 'b', uses: 2, maxUses: 0 },
		);

		expect(findUsedInvite(before, after)?.code).toBe('b');
	});

	test('counts a new invite used once, and a spent one Discord deleted', () => {
		expect(findUsedInvite(invites(), invites({ code: 'new', uses: 1, maxUses: 0 }))?.code).toBe(
			'new',
		);
		expect(
			findUsedInvite(invites({ code: 'once', uses: 0, maxUses: 1 }), invites())?.code,
		).toBe('once');
	});

	test('cannot tell when nothing or several invites changed', () => {
		const before = invites(
			{ code: 'a', uses: 1, maxUses: 0 },
			{ code: 'b', uses: 1, maxUses: 0 },
		);

		expect(findUsedInvite(before, before)).toBeUndefined();
		expect(
			findUsedInvite(
				before,
				invites({ code: 'a', uses: 2, maxUses: 0 }, { code: 'b', uses: 2, maxUses: 0 }),
			),
		).toBeUndefined();
	});
});
