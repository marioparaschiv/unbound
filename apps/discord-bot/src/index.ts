import './lib/setup';

import { Events, GatewayIntentBits, Partials, type Client } from 'discord.js';
import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { createBotReads } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';

import { createModeration, type Moderation } from '~/moderation/moderation';
import { createStarboard, type Starboard } from '~/starboard/starboard';
import { createDatabase, POOLED_OPTIONS } from '~/db/database';
import { createMessageGateway } from '~/lib/discord-messages';
import { createAuditTelemetry } from '~/lib/audit-telemetry';
import { loadConfig, type BotConfig } from '~/lib/config';
import { syncIconEmojis } from '~/lib/icon-emojis';
import { startDispatchers } from '~/runtime/start';
import { createDispatchers } from '~/dispatchers';
import { checkTriggers } from '~/db/triggers';
import { CASE_ACTIONS } from '~/lib/mod-case';
import { setDatabase } from '~/db/instance';
import { PREFIX } from '~/lib/constants';

declare module '@sapphire/pieces' {
	// oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
	interface Container {
		/** The configuration `src/index.ts` loaded, for the Sapphire pieces, which Sapphire constructs itself. */
		config: BotConfig;
		/** Set once the client is ready; unset while `STARBOARD_CHANNEL_ID` is. */
		starboard?: Starboard;
		/** Set once the client is ready. */
		moderation?: Moderation;
	}
}

const logger = createLogger('Bot');
const loaded = loadConfig(process.env);

if (!loaded.ok) {
	logger.error(loaded.message);
	process.exit(1);
}

const { config } = loaded;
const { env } = config;
const auditTelemetry = createAuditTelemetry({ env });
const db = createDatabase(env.DATABASE_URL, POOLED_OPTIONS);
// One pool for both: the bot's schema through `db`, the web's tables, read only, through `web`.
const web = createBotReads(db.$client, {
	siteUrl: config.siteUrl,
	cdnUrl: config.cdnUrl,
	sponsorGraceDays: env.SPONSOR_PERK_GRACE_DAYS,
});

container.config = config;
setDatabase(db);

try {
	await checkTriggers(db);
} catch (error) {
	logger.error('Failed to check the triggers on the web tables:', error);
}

const client = new SapphireClient({
	// Sapphire otherwise derives the piece root from the package entry point, which Bun does not set.
	baseUserDirectory: import.meta.dirname,
	defaultPrefix: PREFIX,
	caseInsensitiveCommands: true,
	logger: { level: LogLevel.Debug },
	intents: [
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMessages,
		// The `/debug` help waits for a reaction once the asker opens their DMs.
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.Guilds,
		// Audit log entries, so bans, kicks and timeouts taken outside the bot become cases.
		GatewayIntentBits.GuildModeration,
		// Privileged: the `/debug` help reads questions and the `/debug` card's alt text.
		GatewayIntentBits.MessageContent,
	],
	// Reactions and deletes on messages sent before the bot started arrive as partials; the starboard needs them.
	partials: [Partials.Message, Partials.Reaction, Partials.User],
	loadMessageCommandListeners: true,
	// Sent on every identify, so the status survives reconnects.
	presence: { status: 'dnd' },
});

async function exit(code: number): Promise<never> {
	await client.destroy();
	await auditTelemetry.shutdown();
	await db.$client.end();
	process.exit(code);
}

function startRuntime(ready: Client<true>) {
	const starboardChannelId = config.ids.STARBOARD_CHANNEL_ID;
	const messages = createMessageGateway(ready.rest, ready.user.id);
	const moderation = createModeration({
		db,
		messages,
		guildId: config.guildId,
		logChannelId: config.ids.MOD_LOG_CHANNEL_ID,
		prefix: PREFIX,
		loadIcons: () => syncIconEmojis(ready.rest, ready.application.id, 'mb_case_', CASE_ACTIONS),
	});

	container.moderation = moderation;
	moderation.start(ready);

	if (starboardChannelId) {
		container.starboard = createStarboard({
			db,
			messages,
			guildId: config.guildId,
			channelId: starboardChannelId,
		});
	}

	const dispatchers = createDispatchers({
		config,
		discord: {
			rest: ready.rest,
			selfId: ready.user.id,
			applicationId: ready.application.id,
			guilds: ready.guilds,
		},
		telemetry: auditTelemetry,
		now: Date.now,
	});
	const { stop: stopDispatchers } = startDispatchers(
		dispatchers,
		{ db, web },
		// LISTEN holds a session, which pgbouncer's transaction mode cannot give it.
		env.DATABASE_DIRECT_URL,
		env.RECONCILE_INTERVAL_SECONDS * 1000,
	);

	async function shutdown() {
		moderation.stop();
		await stopDispatchers();
		await exit(0);
	}

	process.once('SIGINT', () => void shutdown());
	process.once('SIGTERM', () => void shutdown());

	logger.success(`Runtime started with ${dispatchers.length} dispatcher(s).`);
}

client.once(Events.ClientReady, (ready) => {
	try {
		startRuntime(ready);
	} catch (error) {
		logger.error('Failed to start the runtime:', error);
		void exit(1);
	}
});

try {
	await client.login(env.DISCORD_TOKEN);
	logger.info(`Logged in as ${client.user?.username ?? 'unknown'}.`);
} catch (error) {
	logger.error('Failed to log in:', error);
	await exit(1);
}
