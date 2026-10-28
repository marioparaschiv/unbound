import { addonAuthorSchema } from '@unbound-app/contracts/manifest';
import { z } from 'zod';

import type { DiscordUser } from '~/lib/authors/discord-users';
import { isBotTokenHost } from '~/lib/discord';
import type { Env } from '~/lib/env';

export type GuildMember = {
	user: DiscordUser;
	roleIds: string[];
};

// Discord's maximum for `GET /guilds/{id}/members`.
const PAGE_LIMIT = 1000;

const REQUEST_TIMEOUT_MS = 30_000;

const memberSchema = z.object({
	user: z.object({
		id: addonAuthorSchema.shape.id,
		username: z.string().min(1),
		global_name: z.string().nullish(),
		avatar: z.string().nullish(),
	}),
	roles: z.array(z.string()),
});

const pageSchema = z.array(memberSchema).max(PAGE_LIMIT);

async function fetchPage(env: Env, after: string, signal?: AbortSignal) {
	const base = `${env.DISCORD_API_URL.replace(/\/$/, '')}/`;
	const url = new URL(`guilds/${env.DISCORD_GUILD_ID}/members`, base);

	url.searchParams.set('limit', String(PAGE_LIMIT));
	url.searchParams.set('after', after);

	if (!isBotTokenHost(url)) {
		throw new Error(`Refusing to send the Discord bot token to ${url.host}.`);
	}

	const response = await fetch(url, {
		headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
		redirect: 'error',
		signal: AbortSignal.any([
			AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			...(signal ? [signal] : []),
		]),
	});

	if (!response.ok) {
		throw new Error(
			`Discord answered ${response.status} listing the members of guild ${env.DISCORD_GUILD_ID}.`,
		);
	}

	return pageSchema.parse(await response.json());
}

/**
 * @description Lists every member of the Unbound guild with the bot token, a page of 1000 at a time.
 * Needs the bot's Server Members privileged intent.
 * @param env The validated environment.
 * @param signal Cancels the listing.
 * @returns Every member; throws on any failed or malformed page, so a partial list is never returned.
 */
export async function fetchGuildMembers(env: Env, signal?: AbortSignal): Promise<GuildMember[]> {
	const members: GuildMember[] = [];
	let after = '0';

	for (;;) {
		const page = await fetchPage(env, after, signal);

		for (const member of page) {
			members.push({
				user: {
					id: member.user.id,
					username: member.user.username,
					globalName: member.user.global_name || null,
					avatarHash: member.user.avatar ?? null,
				},
				roleIds: member.roles,
			});
		}

		const last = page.at(-1);

		if (page.length < PAGE_LIMIT || !last) {
			return members;
		}

		after = last.user.id;
	}
}

export default { fetchGuildMembers };
