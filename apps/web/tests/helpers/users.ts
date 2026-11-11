import { eq } from 'drizzle-orm';

import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { linkGitHub, signInWithDiscord, snowflakeAt, type SignedInUser } from './context';

/** A signed-up user: their session, profile and the caller they act as. */
export type TestUser = SignedInUser & {
	name: string;
	email: string;
	discordId: string;
	caller: Caller;
};

export type SignUpOptions = {
	/** A site role, or several joined by commas as better-auth stores them (`ci,user`). */
	role?: Role | `${Role},${Role}`;
	name?: string;
	email?: string;
	/** Defaults to a Discord account created in 2020, old enough to submit. */
	discordId?: string;
	/** A GitHub token to link; without one GitHub stays unlinked. */
	github?: string;
};

const ACCOUNT_CREATED_MS = Date.UTC(2020, 0, 1);

let signUps = 0;

/**
 * @description Signs a user up through Discord as the OAuth callback does, sets their site role and
 * links GitHub when asked.
 * @param ctx The application context.
 * @param options The role, profile and GitHub token; each has a unique default.
 * @returns The user's session headers, profile and caller.
 */
export async function signUpUser(ctx: AppContext, options: SignUpOptions = {}): Promise<TestUser> {
	signUps += 1;

	const {
		role = 'user',
		name = `User ${signUps}`,
		email = `user-${signUps}@example.com`,
		discordId = snowflakeAt(new Date(ACCOUNT_CREATED_MS + signUps)),
		github,
	} = options;
	const signedIn = await signInWithDiscord(ctx, { id: discordId, name, email });

	await ctx.db.update(user).set({ role }).where(eq(user.id, signedIn.userId));

	if (github) {
		await linkGitHub(ctx, signedIn.userId, github);
	}

	const row = await ctx.db.query.user.findFirst({ where: { id: signedIn.userId } });

	if (!row) {
		throw new Error(`Failed to sign up user ${signedIn.userId}: the row was not stored.`);
	}

	return { ...signedIn, name, email, discordId, caller: { user: row, via: 'session' } };
}

export default { signUpUser };
