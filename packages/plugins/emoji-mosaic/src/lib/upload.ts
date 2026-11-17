import { flux, metro } from '@unbound-app/api';

import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';

import { encodePng } from '@unbound-plugins/shared/media/png';
import { TILE, type Tile } from '~/lib/tiles';

const STATIC_SLOTS: Record<number, number> = { 0: 50, 1: 100, 2: 150, 3: 250 };
const PACING_MS = 1200;
const MAX_RETRIES = 3;

type Http = {
	post(request: { url: string; body: unknown }): Promise<{ body: { id: string; name: string } }>;
};

type RateLimited = { status?: number; body?: { retry_after?: number } };

type GuildLike = { id: string; name: string; premiumTier?: number };

type PermissionStore = { can(permission: bigint | number, target: unknown): boolean };

type EmojiStore = { getGuildEmoji?(guildId: string): { animated?: boolean }[] | undefined };

export type UploadTarget = { id: string; name: string; free: number };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function canAddEmoji(guild: GuildLike): boolean {
	const { Permissions } = metro.common.Constants;
	const permissions = flux.getStore('Permission') as unknown as PermissionStore;
	const can = (permission: bigint) => permissions.can(permission, guild);

	return can(Permissions.CREATE_GUILD_EXPRESSIONS) || can(Permissions.MANAGE_GUILD_EXPRESSIONS);
}

function freeSlots(guild: GuildLike): number {
	const emoji = (flux.getStore('Emoji') as unknown as EmojiStore).getGuildEmoji?.(guild.id) ?? [];
	const used = emoji.filter((entry) => !entry.animated).length;

	return Math.max(0, (STATIC_SLOTS[guild.premiumTier ?? 0] ?? 50) - used);
}

/**
 * @description Lists the servers where the user may add emoji, with how many static emoji slots each has left.
 * @param firstId A server to put first, such as the current channel's.
 * @returns The servers, that one first, then most free slots first.
 */
export function uploadTargets(firstId?: string): UploadTarget[] {
	const guilds = Object.values(flux.getStore('Guild').getGuilds()) as GuildLike[];

	return guilds
		.filter(canAddEmoji)
		.map((guild) => ({ id: guild.id, name: guild.name, free: freeSlots(guild) }))
		.sort(
			(left, right) =>
				Number(right.id === firstId) - Number(left.id === firstId) ||
				right.free - left.free,
		);
}

async function createEmoji(
	http: Http,
	guildId: string,
	tile: Tile,
	attempt = 0,
): Promise<{ id: string; name: string }> {
	try {
		const image = `data:image/png;base64,${toBase64(encodePng(tile.rgba, TILE, TILE))}`;
		const { body } = await http.post({
			url: `/guilds/${guildId}/emojis`,
			body: { name: tile.name, image },
		});

		return { id: body.id, name: body.name };
	} catch (error) {
		const limited = error as RateLimited;

		if (limited.status !== 429 || attempt >= MAX_RETRIES) throw error;

		await wait(Math.ceil((limited.body?.retry_after ?? 5) * 1000));

		return createEmoji(http, guildId, tile, attempt + 1);
	}
}

/**
 * @description Uploads tiles as emoji one at a time, waiting out Discord's rate limit.
 * @param guildId The server.
 * @param tiles The tiles, row by row.
 * @param onProgress Called after each upload with how many are done.
 * @returns Each uploaded emoji's name and id, row by row.
 */
export async function uploadTiles(
	guildId: string,
	tiles: Tile[],
	onProgress: (done: number) => void,
): Promise<{ id: string; name: string }[]> {
	const http = metro.findByProps('getAPIBaseURL', 'post') as Http | undefined;

	if (!http) throw new Error("Discord's HTTP client was not found");

	const uploaded: { id: string; name: string }[] = [];

	for (const tile of tiles) {
		uploaded.push(await createEmoji(http, guildId, tile));
		onProgress(uploaded.length);

		if (uploaded.length < tiles.length) await wait(PACING_MS);
	}

	return uploaded;
}
