import './lib/setup';

import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { Events, GatewayIntentBits, type Client } from 'discord.js';
import { createBotReads } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';

import { createDatabase, POOLED_OPTIONS } from '~/db/database';
import { createAuditTelemetry } from '~/lib/audit-telemetry';
import { loadConfig, type BotConfig } from '~/lib/config';
import { startDispatchers } from '~/runtime/start';
import { createDispatchers } from '~/dispatchers';
import { checkTriggers } from '~/db/triggers';
import { setDatabase } from '~/db/instance';

declare module '@sapphire/pieces' {
	// oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
	interface Container {
		/** The configuration `src/index.ts` loaded, for the Sapphire pieces, which Sapphire constructs itself. */
		config: BotConfig;
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
const dispatchers = createDispatchers({ config, telemetry: auditTelemetry });
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
	defaultPrefix: '!',
	caseInsensitiveCommands: true,
	logger: { level: LogLevel.Debug },
	intents: [
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.Guilds,
	],
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
	const { started, stop: stopDispatchers } = startDispatchers(
		dispatchers,
		{ db, web, client: ready },
		// LISTEN holds a session, which pgbouncer's transaction mode cannot give it.
		env.DATABASE_DIRECT_URL,
		env.RECONCILE_INTERVAL_SECONDS * 1000,
	);

	async function shutdown() {
		await stopDispatchers();
		await exit(0);
	}

	process.once('SIGINT', () => void shutdown());
	process.once('SIGTERM', () => void shutdown());

	logger.success(`Runtime started with ${started.length} dispatcher(s).`);
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
