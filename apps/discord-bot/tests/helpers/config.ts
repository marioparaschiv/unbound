import { loadConfig, type BotConfig, type EnvSource } from '~/lib/config';

/** The variables `loadConfig` requires, with placeholder values. */
export const REQUIRED_ENV = {
	DISCORD_TOKEN: 'token',
	DATABASE_URL: 'postgres://bot@localhost:6432/bot',
	DATABASE_DIRECT_URL: 'postgres://bot@localhost:5432/bot',
};

/**
 * @description Loads the configuration from the required variables plus `source`, as startup does.
 * @param source Variables to set or override.
 * @returns The configuration; throws with the startup message when it is invalid.
 */
export function testConfig(source: EnvSource = {}): BotConfig {
	const loaded = loadConfig({ ...REQUIRED_ENV, ...source });

	if (!loaded.ok) {
		throw new Error(loaded.message);
	}

	return loaded.config;
}
