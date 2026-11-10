import { createLogger } from '@unbound-app/logger';
import type { REST } from 'discord.js';

import { IDS_SOURCE, type BotConfig, type DiscordIds, type IdConstantName } from '~/lib/config';
import { createRolesDispatcher, ROLE_CONSTANTS, type RolesGuilds } from '~/dispatchers/roles';
import { addonChannels, createAddonsDispatcher } from '~/dispatchers/addons';
import { createReviewNoticesDispatcher } from '~/dispatchers/review-notices';
import { createContributorCache } from '~/lib/github-contributors';
import { createReleasesDispatcher } from '~/dispatchers/releases';
import { createMessageGateway } from '~/lib/discord-messages';
import { createAuditDispatcher } from '~/dispatchers/audit';
import type { AuditTelemetry } from '~/lib/audit-telemetry';
import { createAuthorEmojis } from '~/lib/author-emojis';
import type { Dispatcher } from '~/dispatchers/types';

/** The ready Discord client's parts the dispatchers use. */
export type DispatcherDiscord = {
	rest: REST;
	/** The bot's own user id, which marks its messages. */
	selfId: string;
	/** The bot application, which owns the author avatar emojis. */
	applicationId: string;
	guilds: RolesGuilds;
};

export type DispatchersOptions = {
	config: BotConfig;
	discord: DispatcherDiscord;
	telemetry: AuditTelemetry;
	/** The clock, in epoch milliseconds. */
	now: () => number;
};

type SetIds<K extends IdConstantName> = Readonly<Record<K, string>>;
type Entry = (ids: DiscordIds) => Dispatcher | undefined;

const logger = createLogger('Bot', 'Dispatchers');

function hasIds<K extends IdConstantName>(
	ids: DiscordIds,
	names: readonly K[],
): ids is DiscordIds & SetIds<K> {
	return names.every((name) => ids[name] !== undefined);
}

// A dispatcher whose ids are not all set is not built, and the operator is told which to set.
function entry<K extends IdConstantName>(
	name: string,
	requires: readonly K[],
	create: (ids: SetIds<K>) => Dispatcher,
): Entry {
	return (ids) => {
		if (hasIds(ids, requires)) {
			return create(ids);
		}

		const missing = requires.filter((required) => ids[required] === undefined);

		logger.warn(
			`Not starting ${name}: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} still unset in ${IDS_SOURCE}.`,
		);

		return undefined;
	};
}

/**
 * @description Builds every dispatcher whose id constants are set, from the configuration; each track adds one entry here.
 * @param options The configuration, the ready Discord client's parts, the audit telemetry and the clock.
 * @returns The dispatchers the runtime starts; each skipped one was logged with its unset constants.
 */
export function createDispatchers(options: DispatchersOptions): Dispatcher[] {
	const { config, discord, telemetry, now } = options;
	const messages = createMessageGateway(discord.rest, discord.selfId);
	// One per process, so its avatar lookups and emoji listing outlive a single run.
	const emojis = createAuthorEmojis(discord.rest, discord.applicationId);
	const entries = [
		entry(
			'addons',
			['PLUGINS_CHANNEL_ID', 'THEMES_CHANNEL_ID', 'ICON_PACKS_CHANNEL_ID'],
			(ids) => createAddonsDispatcher({ channels: addonChannels(ids), messages, emojis }),
		),
		entry('releases', ['RELEASES_CHANNEL_ID', 'RELEASES_ROLE_ID'], (ids) =>
			createReleasesDispatcher({
				channelId: ids.RELEASES_CHANNEL_ID,
				roleId: ids.RELEASES_ROLE_ID,
				messages,
				now,
			}),
		),
		// Audit and review notices are two cursors over one stream: each `audit_event` wakes both.
		entry('audit', ['AUDIT_LOG_CHANNEL_ID'], (ids) =>
			createAuditDispatcher({
				channelId: ids.AUDIT_LOG_CHANNEL_ID,
				siteUrl: config.siteUrl,
				telemetry,
				messages,
			}),
		),
		entry('review-notices', [], () =>
			createReviewNoticesDispatcher({ siteUrl: config.siteUrl, messages }),
		),
		entry('roles', ROLE_CONSTANTS, (ids) =>
			createRolesDispatcher({
				guildId: config.guildId,
				guilds: discord.guilds,
				contributors: createContributorCache({ token: config.env.GITHUB_TOKEN }),
				ids,
				now,
			}),
		),
	];

	return entries.flatMap((build) => build(config.ids) ?? []);
}

export default { createDispatchers };
