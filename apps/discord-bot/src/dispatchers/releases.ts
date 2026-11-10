import type { LoaderPlatform } from '@unbound-app/contracts/loader';
import type { RESTPostAPIChannelMessageJSONBody } from 'discord.js';
import type { Release, ReleaseKey } from '@unbound-app/web/bot';
import { ButtonStyle, ComponentType } from 'discord.js';
import { createLogger } from '@unbound-app/logger';
import { and, eq } from 'drizzle-orm';

import type { Dispatcher, DispatcherContext } from '~/dispatchers/types';
import type { MessageGateway } from '~/lib/discord-messages';
import type { Database } from '~/db/database';
import { releasePost } from '~/db/schema';
import { COLOURS } from '~/lib/constants';

export type ReleaseTarget = {
	channelId: string;
	roleId: string;
};

export type ReleasesOptions = ReleaseTarget & {
	messages: MessageGateway;
	/** The clock, in epoch milliseconds; a release older than a week is never announced. */
	now: () => number;
};

const logger = createLogger('Bot', 'Releases');

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
	messages: MessageGateway,
	target: ReleaseTarget,
	unannounced: Release[],
): Promise<Release[]> {
	const byTitle = new Map(unannounced.map((release) => [releaseTitle(release), release]));

	for (const message of await messages.listOwn(target.channelId)) {
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
async function announce(
	db: Database,
	messages: MessageGateway,
	release: Release,
	target: ReleaseTarget,
) {
	const messageId = await messages.post(target.channelId, {
		body: renderRelease(release, target.roleId),
	});

	await recordPost(db, release, target.channelId, messageId);
}

/**
 * @description Creates the dispatcher that announces each fresh loader release once, pinging the releases role.
 * @param options The channel and role, the bot's Discord messages and the clock.
 * @returns The `loader_release` dispatcher.
 */
export function createReleasesDispatcher(options: ReleasesOptions): Dispatcher {
	const { messages, now, ...target } = options;

	// Announces the release a `platform:version` payload names unless it was announced already.
	async function announceRelease({ db, web }: DispatcherContext, payload: string) {
		const key = parseKey(payload);

		if (!key) return;

		const [release, [posted]] = await Promise.all([
			web.release(key),
			db
				.select({ messageId: releasePost.messageId })
				.from(releasePost)
				.where(
					and(
						eq(releasePost.platform, key.platform),
						eq(releasePost.version, key.version),
					),
				),
		]);

		if (!release || posted || release.publishedAt < freshSince(now())) return;

		await announce(db, messages, release, target);
	}

	// Adopts announcements a crash left unrecorded, then announces every unannounced fresh release in
	// publish order; one release's failure is logged and left to the next run.
	async function reconcileReleases({ db, web }: DispatcherContext) {
		const [fresh, posts] = await Promise.all([
			web.releasesSince(freshSince(now())),
			db
				.select({ platform: releasePost.platform, version: releasePost.version })
				.from(releasePost),
		]);
		const posted = new Set(posts.map(keyOf));
		const unannounced = await adoptOrphans(
			db,
			messages,
			target,
			fresh.filter((release) => !posted.has(keyOf(release))),
		);

		for (const release of unannounced) {
			try {
				await announce(db, messages, release, target);
			} catch (error) {
				logger.error(`Failed to announce ${release.platform} ${release.version}:`, error);
			}
		}
	}

	return {
		name: 'releases',
		channel: 'loader_release',
		reconcile: reconcileReleases,
		handle: (payload, context) => announceRelease(context, payload),
	};
}

export default { renderRelease, createReleasesDispatcher };
