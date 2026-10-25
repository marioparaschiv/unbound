import type { REST, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { createLogger } from '@unbound-app/logger';

import { COLOURS, RELEASES_CHANNEL_ID, RELEASES_ROLE_ID } from '~/lib/constants';
import { listOwnMessages, postMessage, truncate } from '~/lib/discord-messages';
import type { LoaderPlatform } from '~/lib/feed/types';
import type { Dispatcher } from '~/dispatchers/types';
import type { Database } from '~/db/database';
import { loaderRelease } from '~/db/schema';

export type ReleaseTarget = {
	channelId: string;
	roleId: string;
};

type ReleaseRow = typeof loaderRelease.$inferSelect;

const logger = createLogger('Bot', 'Releases');

type ReleaseKey = {
	platform: LoaderPlatform;
	version: string;
};

export const RELEASE_TARGET: ReleaseTarget = {
	channelId: RELEASES_CHANNEL_ID,
	roleId: RELEASES_ROLE_ID,
};

const PLATFORM_NAMES: Record<LoaderPlatform, string> = { ios: 'iOS', android: 'Android' };
// An older release is never announced, or a first deploy would ping the role once per historic release.
const RELEASE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Discord rejects an embed over 6000 characters in all, which would fail the post on every retry.
const CHANGELOG_LIMIT = 4000;

function isPlatform(value: string): value is LoaderPlatform {
	return Object.hasOwn(PLATFORM_NAMES, value);
}

function byKey(key: ReleaseKey) {
	return and(eq(loaderRelease.platform, key.platform), eq(loaderRelease.version, key.version));
}

function isFresh(now: number) {
	return gte(loaderRelease.publishedAt, new Date(now - RELEASE_MAX_AGE_MS));
}

function parseKey(payload: string): ReleaseKey | undefined {
	const separator = payload.indexOf(':');
	const platform = payload.slice(0, separator);

	if (separator < 0 || !isPlatform(platform)) return;

	return { platform, version: payload.slice(separator + 1) };
}

function releaseTitle(release: ReleaseRow) {
	return `Unbound for ${PLATFORM_NAMES[release.platform]} ${release.version}`;
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
				title: releaseTitle(release),
				url: release.url,
				description: release.changelog
					? truncate(release.changelog, CHANGELOG_LIMIT)
					: undefined,
				color: COLOURS.brand,
				timestamp: release.publishedAt.toISOString(),
			},
		],
		allowed_mentions: { parse: [], roles: [roleId] },
	};
}

// Our listed announcement whose title names an unannounced release lost its id write, so it is
// adopted. Nothing here is ever deleted: its ping already happened.
async function adoptOrphans(db: Database, rest: REST, selfId: string, target: ReleaseTarget) {
	const unannounced = await db
		.select()
		.from(loaderRelease)
		.where(isNull(loaderRelease.messageId));
	const byTitle = new Map(unannounced.map((row) => [releaseTitle(row), row]));

	for (const message of await listOwnMessages(rest, target.channelId, selfId)) {
		const title = message.embeds[0]?.title;
		const release = title ? byTitle.get(title) : undefined;

		if (!title || !release) {
			continue;
		}

		byTitle.delete(title);
		await db
			.update(loaderRelease)
			.set({ channelId: target.channelId, messageId: message.id })
			.where(byKey(release));
	}
}

// Once posted, a release is never edited or reposted, even if its message was deleted by hand:
// a repost would ping the role a second time.
async function announce(db: Database, rest: REST, release: ReleaseRow, target: ReleaseTarget) {
	const messageId = await postMessage(
		rest,
		target.channelId,
		renderRelease(release, target.roleId),
	);

	await db
		.update(loaderRelease)
		.set({ channelId: target.channelId, messageId })
		.where(byKey(release));
}

/**
 * @description Announces the release named by a `platform:version` payload unless it was announced already.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param payload The `loader_release` notification payload.
 * @param target The channel to post in and the role to ping.
 * @param now The current time in milliseconds; a release older than a week is skipped.
 * @returns Resolves once the release is announced, found already announced, or skipped as old.
 */
export async function announceRelease(
	db: Database,
	rest: REST,
	payload: string,
	target: ReleaseTarget = RELEASE_TARGET,
	now: number = Date.now(),
): Promise<void> {
	const key = parseKey(payload);

	if (!key) return;

	const [release] = await db
		.select()
		.from(loaderRelease)
		.where(and(byKey(key), isNull(loaderRelease.messageId), isFresh(now)));

	if (!release) return;

	await announce(db, rest, release, target);
}

/**
 * @description Adopts announcements a crash left unrecorded, then announces every unannounced release in publish order.
 * @param db The bot database.
 * @param rest The Discord REST client.
 * @param selfId The bot's own user id.
 * @param target The channel to post in and the role to ping.
 * @param now The current time in milliseconds; releases older than a week are skipped.
 * @returns Resolves once every release was tried; one release's failure is logged and left to the next run.
 */
export async function reconcileReleases(
	db: Database,
	rest: REST,
	selfId: string,
	target: ReleaseTarget = RELEASE_TARGET,
	now: number = Date.now(),
): Promise<void> {
	await adoptOrphans(db, rest, selfId, target);

	const unannounced = await db
		.select()
		.from(loaderRelease)
		.where(and(isNull(loaderRelease.messageId), isFresh(now)))
		.orderBy(asc(loaderRelease.publishedAt), loaderRelease.platform, loaderRelease.version);

	for (const release of unannounced) {
		try {
			await announce(db, rest, release, target);
		} catch (error) {
			logger.error(`Failed to announce ${release.platform} ${release.version}:`, error);
		}
	}
}

export const releasesDispatcher: Dispatcher = {
	name: 'releases',
	channel: 'loader_release',
	requires: ['RELEASES_CHANNEL_ID', 'RELEASES_ROLE_ID'],
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
