import type { APIMessage, REST, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { DiscordAPIError, RESTJSONErrorCodes, Routes } from 'discord.js';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { COLOURS, RELEASES_CHANNEL_ID, RELEASES_ROLE_ID } from '~/lib/constants';
import type { LoaderPlatform } from '~/lib/feed/types';
import type { Dispatcher } from '~/dispatchers/types';
import type { Database } from '~/db/database';
import { loaderRelease } from '~/db/schema';

export type ReleaseTarget = {
	channelId: string;
	roleId: string;
};

type ReleaseRow = typeof loaderRelease.$inferSelect;

type ReleaseKey = {
	platform: LoaderPlatform;
	version: string;
};

export const RELEASE_TARGET: ReleaseTarget = {
	channelId: RELEASES_CHANNEL_ID,
	roleId: RELEASES_ROLE_ID,
};

const PLATFORM_NAMES: Record<LoaderPlatform, string> = { ios: 'iOS', android: 'Android' };
const PAGE_LIMIT = 100;
// Discord rejects a longer description, which would fail the post on every retry.
const DESCRIPTION_LIMIT = 4096;

function truncate(text: string, max: number) {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function isUnknownMessage(error: unknown): error is DiscordAPIError {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage;
}

function isPlatform(value: string): value is LoaderPlatform {
	return Object.hasOwn(PLATFORM_NAMES, value);
}

function newest(ids: string[]) {
	return ids.reduce((max, id) => (BigInt(id) > BigInt(max) ? id : max), '0');
}

function oldestFirst(a: APIMessage, b: APIMessage) {
	return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
}

function byKey(key: ReleaseKey) {
	return and(eq(loaderRelease.platform, key.platform), eq(loaderRelease.version, key.version));
}

function parseKey(payload: string): ReleaseKey | undefined {
	const separator = payload.indexOf(':');
	const platform = payload.slice(0, separator);

	if (separator < 0 || !isPlatform(platform)) return;

	return { platform, version: payload.slice(separator + 1) };
}

/**
 * @description Renders a loader release announcement that pings only the releases role.
 * @param release The release row.
 * @param roleId The role to ping.
 * @returns The message body to post.
 */
export function renderRelease(
	release: ReleaseRow,
	roleId: string,
): RESTPostAPIChannelMessageJSONBody {
	return {
		content: `<@&${roleId}>`,
		embeds: [
			{
				title: `Unbound for ${PLATFORM_NAMES[release.platform]} ${release.version}`,
				url: release.url,
				description: release.changelog
					? truncate(release.changelog, DESCRIPTION_LIMIT)
					: undefined,
				color: COLOURS.brand,
				timestamp: release.publishedAt.toISOString(),
			},
		],
		allowed_mentions: { parse: [], roles: [roleId] },
	};
}

async function deleteMessage(rest: REST, channelId: string, messageId: string) {
	try {
		await rest.delete(Routes.channelMessage(channelId, messageId));
	} catch (error) {
		if (!isUnknownMessage(error)) {
			throw error;
		}
	}
}

async function ownMessagesAfter(rest: REST, channelId: string, selfId: string, after: string) {
	const own: APIMessage[] = [];
	let cursor = after;
	let page: APIMessage[];

	do {
		const query = new URLSearchParams({ after: cursor, limit: String(PAGE_LIMIT) });

		page = (await rest.get(Routes.channelMessages(channelId), { query })) as APIMessage[];
		cursor = newest([cursor, ...page.map((message) => message.id)]);
		own.push(...page.filter((message) => message.author.id === selfId));
	} while (page.length === PAGE_LIMIT);

	return own.sort(oldestFirst);
}

// Posts are serial and a crash stops all posting until the startup reconcile, so an announcement
// posted without its id being stored is one of ours newer than every stored id in the channel.
async function adoptOrphans(db: Database, rest: REST, selfId: string, target: ReleaseTarget) {
	const releases = await db.select().from(loaderRelease);
	const unannounced = new Map(
		releases.filter((row) => !row.messageId).map((row) => [row.url, row]),
	);
	const after = newest(
		releases.flatMap((row) =>
			row.channelId === target.channelId && row.messageId ? [row.messageId] : [],
		),
	);

	for (const message of await ownMessagesAfter(rest, target.channelId, selfId, after)) {
		const url = message.embeds[0]?.url;
		const release = url ? unannounced.get(url) : undefined;

		// With no stored id the scan starts at the channel's beginning, where an unmatched message
		// predates this bot's rows (an old bot, a manual post), so only a later one is deleted.
		if (!url || !release) {
			if (after !== '0') {
				await deleteMessage(rest, target.channelId, message.id);
			}

			continue;
		}

		unannounced.delete(url);
		await db
			.update(loaderRelease)
			.set({ channelId: target.channelId, messageId: message.id })
			.where(byKey(release));
	}
}

// Once posted, a release is never edited or reposted, even if its message was deleted by hand:
// a repost would ping the role a second time.
async function announce(db: Database, rest: REST, release: ReleaseRow, target: ReleaseTarget) {
	const body = renderRelease(release, target.roleId);
	const message = (await rest.post(Routes.channelMessages(target.channelId), {
		body,
	})) as APIMessage;

	await db
		.update(loaderRelease)
		.set({ channelId: target.channelId, messageId: message.id })
		.where(byKey(release));
}

/**
 * @description Announces the release named by a `platform:version` payload unless it was announced already.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param payload The `loader_release` notification payload.
 * @param target The channel to post in and the role to ping.
 * @returns Resolves once the release is announced or found already announced.
 */
export async function announceRelease(
	db: Database,
	rest: REST,
	payload: string,
	target: ReleaseTarget = RELEASE_TARGET,
): Promise<void> {
	const key = parseKey(payload);

	if (!key) return;

	const [release] = await db
		.select()
		.from(loaderRelease)
		.where(and(byKey(key), isNull(loaderRelease.messageId)));

	if (!release) return;

	await announce(db, rest, release, target);
}

/**
 * @description Adopts announcements a crash left unrecorded, then announces every unannounced release in publish order.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param selfId The bot's own user id.
 * @param target The channel to post in and the role to ping.
 * @returns Resolves once every release is announced.
 */
export async function reconcileReleases(
	db: Database,
	rest: REST,
	selfId: string,
	target: ReleaseTarget = RELEASE_TARGET,
): Promise<void> {
	await adoptOrphans(db, rest, selfId, target);

	const unannounced = await db
		.select()
		.from(loaderRelease)
		.where(isNull(loaderRelease.messageId))
		.orderBy(asc(loaderRelease.publishedAt), loaderRelease.platform, loaderRelease.version);

	for (const release of unannounced) {
		await announce(db, rest, release, target);
	}
}

export const releasesDispatcher: Dispatcher = {
	name: 'releases',
	channel: 'loader_release',
	reconcile: ({ db, client }) => reconcileReleases(db, client.rest, client.user.id),
	handle: (payload, { db, client }) => announceRelease(db, client.rest, payload),
};

export default {
	RELEASE_TARGET,
	renderRelease,
	announceRelease,
	reconcileReleases,
	releasesDispatcher,
};
