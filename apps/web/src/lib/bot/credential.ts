import { eq } from 'drizzle-orm';

import type { AppContext } from '~/lib/context';
import { user } from '~/db/schema';

export const BOT_USER_NAME = 'Unbound Bot';

/** A reserved TLD, so the address can never belong to a real person. */
export const BOT_USER_EMAIL = 'bot@unbound.invalid';

export const BOT_KEY_NAME = 'discord-bot';

/**
 * @description Finds or creates the Discord bot's user and gives it the `bot` role.
 * @param ctx The application context.
 * @returns The bot user's id.
 */
export async function ensureBotUser(ctx: AppContext): Promise<string> {
	const existing = await ctx.db.query.user.findFirst({
		where: { email: BOT_USER_EMAIL },
		columns: { id: true },
	});

	if (existing) {
		await ctx.db.update(user).set({ role: 'bot' }).where(eq(user.id, existing.id));

		return existing.id;
	}

	const { internalAdapter } = await ctx.auth.$context;
	const created = await internalAdapter.createUser(
		{ name: BOT_USER_NAME, email: BOT_USER_EMAIL, role: 'bot' },
		{ method: 'admin' },
	);

	return created.id;
}

/**
 * @description Mints a new API key for the Discord bot's user, creating the user on first use. Earlier
 * keys stay valid. The bot polls, so the key has no per-key rate limit.
 * @param ctx The application context.
 * @returns The key, which is shown only this once.
 */
export async function mintBotKey(ctx: AppContext): Promise<string> {
	const userId = await ensureBotUser(ctx);
	const { key } = await ctx.auth.api.createApiKey({
		body: { userId, name: BOT_KEY_NAME, rateLimitEnabled: false },
	});

	return key;
}

export default { BOT_USER_NAME, BOT_USER_EMAIL, BOT_KEY_NAME, ensureBotUser, mintBotKey };
