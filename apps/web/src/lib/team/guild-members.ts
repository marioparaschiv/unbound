import { parse, safeParse, Type } from '@unbound-app/contracts/schema';
import { addonAuthorSchema } from '@unbound-app/contracts/manifest';

import type { DiscordUser } from '~/lib/authors/discord-users';
import { isBotTokenHost } from '~/lib/discord';
import type { DiscordId } from '~/db/schema';
import type { Env } from '~/lib/env';

export type GuildMember = {
	user: DiscordUser;
	/** The banner they set for this guild alone. */
	bannerHash: string | null;
	roleIds: string[];
};

const REQUEST_TIMEOUT_MS = 30_000;

// Retries of one lookup Discord rate limits before the sync gives up on this run.
const RATE_LIMIT_RETRIES = 3;

// Unknown Member and Unknown User: not in the guild, or a deleted account.
const ABSENT_CODES = new Set([10_007, 10_013]);

const memberSchema = Type.Object({
	user: Type.Object({
		id: addonAuthorSchema.properties.id,
		username: Type.String({ minLength: 1 }),
		global_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
		avatar: Type.Optional(Type.Union([Type.String(), Type.Null()])),
		banner: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	}),
	roles: Type.Array(Type.String()),
	banner: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const errorSchema = Type.Object({
	code: Type.Optional(Type.Number()),
	retry_after: Type.Optional(Type.Number()),
});

async function fetchMember(
	env: Env,
	id: DiscordId,
	signal?: AbortSignal,
): Promise<GuildMember | undefined> {
	const base = `${env.DISCORD_API_URL.replace(/\/$/, '')}/`;
	const url = new URL(`guilds/${env.DISCORD_GUILD_ID}/members/${id}`, base);

	if (!isBotTokenHost(url)) {
		throw new Error(`Refusing to send the Discord bot token to ${url.host}.`);
	}

	for (let attempt = 0; ; attempt++) {
		const response = await fetch(url, {
			headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
			redirect: 'error',
			signal: AbortSignal.any([
				AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				...(signal ? [signal] : []),
			]),
		});

		if (response.ok) {
			const member = parse(memberSchema, await response.json());

			return {
				user: {
					id: member.user.id,
					username: member.user.username,
					globalName: member.user.global_name || null,
					avatarHash: member.user.avatar ?? null,
					bannerHash: member.user.banner ?? null,
				},
				bannerHash: member.banner ?? null,
				roleIds: member.roles,
			};
		}

		const body = safeParse(errorSchema, await response.json().catch(() => ({})));
		const error = body.success ? body.data : {};

		if (response.status === 404 && error.code !== undefined && ABSENT_CODES.has(error.code)) {
			return;
		}

		if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
			await Bun.sleep((error.retry_after ?? 1) * 1000);

			continue;
		}

		throw new Error(
			`Discord answered ${response.status} reading member ${id} of guild ${env.DISCORD_GUILD_ID}.`,
		);
	}
}

/**
 * @description Reads the named members of the Unbound guild one at a time with the bot token, so it
 * needs no privileged intent.
 * @param env The validated environment.
 * @param ids The Discord ids to look up.
 * @param signal Cancels the lookups.
 * @returns The ids that are guild members; throws on any other failure, so a partial read is never returned.
 */
export async function fetchGuildMembers(
	env: Env,
	ids: Iterable<DiscordId>,
	signal?: AbortSignal,
): Promise<GuildMember[]> {
	const members: GuildMember[] = [];

	for (const id of ids) {
		const member = await fetchMember(env, id, signal);

		if (member) {
			members.push(member);
		}
	}

	return members;
}

export default { fetchGuildMembers };
