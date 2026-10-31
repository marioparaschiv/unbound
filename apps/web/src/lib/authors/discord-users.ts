import { z } from 'zod';

import { isBotTokenHost } from '~/lib/discord';
import type { DiscordId } from '~/db/schema';
import type { Env } from '~/lib/env';

export type DiscordUser = {
	id: DiscordId;
	username: string;
	globalName: string | null;
	avatarHash: string | null;
	bannerHash: string | null;
};

export type DiscordLookup =
	| { kind: 'found'; user: DiscordUser }
	| { kind: 'missing' }
	| { kind: 'rate_limited'; retryAfterMs: number }
	| { kind: 'failed'; status: number | null };

const REQUEST_TIMEOUT_MS = 10_000;

// Discord always sends `retry_after`; this only covers a 429 from something in front of it.
const DEFAULT_RETRY_AFTER_MS = 60_000;

// A `retry_after` of 0 would resume at once and loop against Discord.
const MIN_RETRY_AFTER_MS = 1000;

const discordUserSchema = z.object({
	id: z.string(),
	username: z.string().min(1),
	global_name: z
		.string()
		.nullish()
		.transform((value) => value || null),
	avatar: z.string().nullish(),
	banner: z.string().nullish(),
});

const rateLimitSchema = z.object({ retry_after: z.number().nonnegative() });

async function readRetryAfterMs(response: Response): Promise<number> {
	const body = rateLimitSchema.safeParse(await response.json().catch(() => null));
	const header = Number(response.headers.get('retry-after'));
	const seconds = body.success ? body.data.retry_after : header;

	return Number.isFinite(seconds) && seconds >= 0
		? Math.max(MIN_RETRY_AFTER_MS, Math.ceil(seconds * 1000))
		: DEFAULT_RETRY_AFTER_MS;
}

/**
 * @description Looks up one Discord user with the bot token.
 * @param env The validated environment.
 * @param id The user's id; never `'0'`.
 * @param signal Cancels the request, e.g. when the refresher stops.
 * @returns The outcome; HTTP and network failures return rather than throw.
 */
export async function fetchDiscordUser(
	env: Env,
	id: DiscordId,
	signal?: AbortSignal,
): Promise<DiscordLookup> {
	const url = new URL(`users/${id}`, `${env.DISCORD_API_URL.replace(/\/$/, '')}/`);

	if (!isBotTokenHost(url)) {
		throw new Error(`Refusing to send the Discord bot token to ${url.host}.`);
	}

	let response: Response;

	try {
		response = await fetch(url, {
			headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
			redirect: 'error',
			signal: AbortSignal.any([
				AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				...(signal ? [signal] : []),
			]),
		});
	} catch {
		return { kind: 'failed', status: null };
	}

	// Discord answers 400 for an id that cannot exist; caching it as missing keeps it from blocking each sweep.
	if (response.status === 404 || response.status === 400) {
		return { kind: 'missing' };
	}

	if (response.status === 429) {
		return { kind: 'rate_limited', retryAfterMs: await readRetryAfterMs(response) };
	}

	const parsed = response.ok
		? discordUserSchema.safeParse(await response.json().catch(() => null))
		: undefined;

	if (!parsed?.success || parsed.data.id !== id) {
		return { kind: 'failed', status: response.status };
	}

	return {
		kind: 'found',
		user: {
			id,
			username: parsed.data.username,
			globalName: parsed.data.global_name ?? null,
			avatarHash: parsed.data.avatar ?? null,
			bannerHash: parsed.data.banner ?? null,
		},
	};
}

export default { fetchDiscordUser };
