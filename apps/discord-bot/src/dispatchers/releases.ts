import { ButtonStyle, ComponentType } from 'discord.js';
import type { REST, RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import type { LoaderPlatform } from '@unbound-app/contracts/loader';
import type { Release, ReleaseKey } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import { and, eq } from 'drizzle-orm';

import { COLOURS, RELEASES_CHANNEL_ID, RELEASES_ROLE_ID } from '~/lib/constants';
import { listOwnMessages, postMessage } from '~/lib/discord-messages';
import type { Dispatcher, Stores } from '~/dispatchers/types';
import type { Database } from '~/db/database';
import { releasePost } from '~/db/schema';

export type ReleaseTarget = {
	channelId: string;
	roleId: string;
};

const logger = createLogger('Bot', 'Releases');

export const RELEASE_TARGET: ReleaseTarget = {
	channelId: RELEASES_CHANNEL_ID,
	roleId: RELEASES_ROLE_ID,
};

const PLATFORM_NAMES: Record<LoaderPlatform, string> = { ios: 'iOS', android: 'Android' };
// An older release is never announced, or a first deploy would ping the role once per historic release.
const RELEASE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isPlatform(value: string): value is LoaderPlatform {
	return Object.hasOwn(PLATFORM_NAMES, value);
}

function keyOf(release: ReleaseKey) {
	return `${release.platform}:${release.version}`;
}

function parseKey(payload: string): ReleaseKey | undefined {
	const separator = payload.indexOf(':');
	const platform = payload.slice(0, separator);

	if (separator < 0 || !isPlatform(platform)) return;

	return { platform, version: payload.slice(separator + 1) };
}

function freshSince(now: number) {
	return new Date(now - RELEASE_MAX_AGE_MS);
}

function releaseTitle(release: ReleaseKey) {
	return `Unbound for ${PLATFORM_NAMES[release.platform]} ${release.version}`;
}

/**
 * @description Renders a compact loader release announcement that links out to the changelog and pings only the releases role.
 * @param release The release.
 * @param roleId The role to ping.
 * @returns The message body to post.
 */
export function renderRelease(release: Release, roleId: string): RESTPostAPIChannelMessageJSONBody {
	return {
		content: `<@&${roleId}>`,
		embeds: [
			{
				title: releaseTitle(release),
				url: release.url,
				color: COLOURS.brand,
				timestamp: release.publishedAt.toISOString(),
			},
		],
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						style: ButtonStyle.Link,
						label: 'View changelog',
						url: release.url,
					},
				],
			},
		],
		allowed_mentions: { parse: [], roles: [roleId] },
	};
}

async function recordPost(db: Database, release: ReleaseKey, channelId: string, messageId: string) {
	await db
		.insert(releasePost)
		.values({ platform: release.platform, version: release.version, channelId, messageId })
		.onConflictDoNothing();
}

// Our listed announcement whose title names an unannounced release lost its row write, so it is
// adopted. Nothing here is ever deleted: its ping already happened.
async function adoptOrphans(
	db: Database,
	rest: REST,
	selfId: string,
	target: ReleaseTarget,
	unannounced: Release[],
): Promise<Release[]> {
	const byTitle = new Map(unannounced.map((release) => [releaseTitle(release), release]));

	for (const message of await listOwnMessages(rest, target.channelId, selfId)) {
		const title = message.embeds[0]?.title;
		const release = title ? byTitle.get(title) : undefined;

		if (!title || !release) {
			continue;
		}

		byTitle.delete(title);
		await recordPost(db, release, target.channelId, message.id);
	}

	return [...byTitle.values()];
}

// Once posted, a release is never edited or reposted, even if its message was deleted by hand:
// a repost would ping the role a second time.
async function announce(db: Database, rest: REST, release: Release, target: ReleaseTarget) {
	const messageId = await postMessage(
		rest,
		target.channelId,
		renderRelease(release, target.roleId),
	);

	await recordPost(db, release, target.channelId, messageId);
}

/**
 * @description Announces the release named by a `platform:version` payload unless it was announced already.
 * @param stores The bot database and the web's reads.
 * @param rest The Discord REST client.
 * @param payload The `loader_release` notification payload.
 * @param target The channel to post in and the role to ping.
 * @param now The current time in milliseconds; a release older than a week is skipped.
 * @returns Resolves once the release is announced, found already announced, or skipped.
 */
export async function announceRelease(
	{ db, web }: Stores,
	rest: REST,
	payload: string,
	target: ReleaseTarget = RELEASE_TARGET,
	now: number = Date.now(),
): Promise<void> {
	const key = parseKey(payload);

	if (!key) return;

	const [release, [posted]] = await Promise.all([
		web.release(key),
		db
			.select({ messageId: releasePost.messageId })
			.from(releasePost)
			.where(
				and(eq(releasePost.platform, key.platform), eq(releasePost.version, key.version)),
			),
	]);

	if (!release || posted || release.publishedAt < freshSince(now)) return;

	await announce(db, rest, release, target);
}

/**
 * @description Adopts announcements a crash left unrecorded, then announces every unannounced fresh release in publish order.
 * @param stores The bot database and the web's reads.
 * @param rest The Discord REST client.
 * @param selfId The bot's own user id.
 * @param target The channel to post in and the role to ping.
 * @param now The current time in milliseconds; releases older than a week are skipped.
 * @returns Resolves once every release was tried; one release's failure is logged and left to the next run.
 */
export async function reconcileReleases(
	{ db, web }: Stores,
	rest: REST,
	selfId: string,
	target: ReleaseTarget = RELEASE_TARGET,
	now: number = Date.now(),
): Promise<void> {
	const [fresh, posts] = await Promise.all([
		web.releasesSince(freshSince(now)),
		db
			.select({ platform: releasePost.platform, version: releasePost.version })
			.from(releasePost),
	]);
	const posted = new Set(posts.map(keyOf));
	const unannounced = await adoptOrphans(
		db,
		rest,
		selfId,
		target,
		fresh.filter((release) => !posted.has(keyOf(release))),
	);

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
	/**
	 * @description Announces every loader release that has no message yet.
	 * @param context The dispatcher's stores and Discord client.
	 * @returns Resolves once every release was announced.
	 */
	reconcile: (context) => reconcileReleases(context, context.client.rest, context.client.user.id),
	/**
	 * @description Announces the loader release a NOTIFY payload names.
	 * @param payload The release payload from the notification.
	 * @param context The dispatcher's stores and Discord client.
	 * @returns Resolves once the release was announced.
	 */
	handle: (payload, context) => announceRelease(context, context.client.rest, payload),
};

export default {
	RELEASE_TARGET,
	renderRelease,
	announceRelease,
	reconcileReleases,
	releasesDispatcher,
};
