import './lib/setup';

import { Events, GatewayIntentBits, type Client } from 'discord.js';
import { LogLevel, SapphireClient } from '@sapphire/framework';
import { createLogger } from '@unbound-app/logger';

import { createFeedClient } from '~/lib/feed/client';
import { startDispatchers } from '~/runtime/start';
import { createDatabase } from '~/db/database';
import { startPoller } from '~/runtime/poller';
import { GUILD_ID } from '~/lib/constants';
import { setDatabase } from '~/db/instance';
import { dispatchers } from '~/dispatchers';
import { checkConfig } from '~/lib/config';

const logger = createLogger('Bot');
const config = checkConfig(process.env, GUILD_ID);

if (!config.ok) {
	logger.error(config.message);
	process.exit(1);
}

const { env } = config;
const db = createDatabase(env.DATABASE_URL);

setDatabase(db);

const client = new SapphireClient({
	// Sapphire otherwise derives the piece root from the package entry point, which Bun does not set.
	baseUserDirectory: import.meta.dirname,
	defaultPrefix: '!',
	caseInsensitiveCommands: true,
	logger: { level: LogLevel.Debug },
	intents: [
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
	],
	loadMessageCommandListeners: true,
});

async function exit(code: number): Promise<never> {
	await client.destroy();
	await db.$client.end();
	process.exit(code);
}

function startRuntime(ready: Client<true>) {
	const { started, stop: stopDispatchers } = startDispatchers(
		dispatchers,
		{ db, client: ready },
		env.DATABASE_URL,
		env.RECONCILE_INTERVAL_SECONDS * 1000,
	);
	const stopPoller = startPoller({
		db,
		fetchPage: createFeedClient(env.UNBOUND_API_URL, env.UNBOUND_API_KEY),
		pageSize: env.FEED_PAGE_SIZE,
		intervalMs: env.POLL_INTERVAL_SECONDS * 1000,
	});

	async function shutdown() {
		await Promise.all([stopPoller(), stopDispatchers()]);
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
