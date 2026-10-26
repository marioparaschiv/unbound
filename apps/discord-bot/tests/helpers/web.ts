import type { createStaffNote } from '@unbound-app/web/testing';
import { type AppContext, schema, signInWithDiscord, snowflakeAt } from '@unbound-app/web/testing';
import { eq } from 'drizzle-orm';

export type WebCaller = Parameters<typeof createStaffNote>[1];

export type WebUser = {
	userId: string;
	discordId: string;
	caller: WebCaller;
};

let users = 0;

/**
 * @description Signs a new user in with Discord on the web, as the OAuth callback does.
 * @param web The web's context.
 * @param role The user's role, e.g. `moderator` to write staff notes.
 * @returns The user, their Discord id and a session caller for the web's functions.
 */
export async function signUp(web: AppContext, role: string = 'user'): Promise<WebUser> {
	users += 1;

	const discordId = snowflakeAt(new Date(Date.UTC(2022, 0, users)));
	const { userId } = await signInWithDiscord(web, {
		id: discordId,
		name: `Member ${users}`,
		email: `bot-member-${users}-${discordId}@example.com`,
	});

	await web.db.update(schema.user).set({ role }).where(eq(schema.user.id, userId));

	const row = await web.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { userId, discordId, caller: { user: row, via: 'session' } };
}
