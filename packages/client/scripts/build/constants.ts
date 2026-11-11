import { semverSchema } from '@unbound-app/contracts/manifest';
import { parse, Type } from '@unbound-app/contracts/schema';
import { apiUrlSchema } from '@unbound-app/contracts/api';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveDevServerUrl, resolveDevHost } from '../dev-host';
import { version, unbound } from '../../package.json';

export const GIT_REVISION = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'N/A';
	}
})();

export const CLIENT_VERSION = parse(semverSchema, version);

/** The oldest loader that runs this bundle; raise it in `package.json` when the bundle needs a newer loader. */
export const MIN_LOADER_VERSION = parse(semverSchema, unbound.minLoaderVersion);

export const API_URL = parse(apiUrlSchema, process.env.UNBOUND_API_URL);

const compatPolicySchema = Type.Object({
	minimumDiscordVersion: Type.Object({
		android: Type.String({ pattern: '^\\d+\\.\\d+$' }),
		ios: Type.String({ pattern: '^\\d+\\.\\d+$' }),
	}),
});

const COMPAT_POLICY_PATH = join(__dirname, '..', '..', '..', 'loader', 'compat-policy.json');

export const MINIMUM_DISCORD_VERSIONS = parse(
	compatPolicySchema,
	JSON.parse(readFileSync(COMPAT_POLICY_PATH, 'utf8')),
).minimumDiscordVersion;

export const IGNORED_WARNINGS = ['PLUGIN_TIMINGS', 'EVAL', 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT'];

const PROD_I18N_BASE_URL = 'https://raw.githubusercontent.com/marioparaschiv/unbound/main/i18n';

export const IS_DEV_BUILD = process.env.UNBOUND_DEV === '1' || process.argv.includes('--dev');

export const BUILD_CHANNEL =
	process.env.UNBOUND_CHANNEL?.trim() || (IS_DEV_BUILD ? 'dev' : 'local');

// The `serve` script's origin, baked in for locale tables and hot reload. Defaults to the LAN IP, as
// a physical device can't reach `localhost` (that's the phone itself).
export const DEV_SERVER_URL = IS_DEV_BUILD ? resolveDevServerUrl() : '';
export const I18N_BASE_URL = IS_DEV_BUILD
	? process.env.I18N_DEV_URL || `${DEV_SERVER_URL}/i18n`
	: PROD_I18N_BASE_URL;

// The debugger (REPL + MCP HTTP API) server, on the same machine as the dev server. Honours an
// explicit `DEBUGGER_ADDRESS` override, otherwise tracks the dev host on the debugger's default port.
export const DEBUGGER_PORT = process.env.DEBUGGER_PORT || '9090';
export const DEBUGGER_ADDRESS = IS_DEV_BUILD
	? process.env.DEBUGGER_ADDRESS || `${resolveDevHost()}:${DEBUGGER_PORT}`
	: '';
