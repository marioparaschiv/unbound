import { execSync } from 'child_process';

import { resolveDevServerUrl, resolveDevHost } from '../dev-host';

export const GIT_REVISION = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'N/A';
	}
})();

export const IGNORED_WARNINGS = ['PLUGIN_TIMINGS', 'EVAL', 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT'];

export const PROD_I18N_BASE_URL =
	'https://raw.githubusercontent.com/marioparaschiv/unbound/main/i18n';

export const IS_DEV_BUILD = process.env.UNBOUND_DEV === '1' || process.argv.includes('--dev');

// The `serve` script's origin, baked into the bundle so the device can fetch
// locale tables and the hot-reload stream. Resolved from `--host <ip>`, then
// `DEV_HOST`/`DEV_SERVER_URL`, then the auto-detected LAN IP - a physical device
// can't reach `localhost` (that's the phone itself), so the LAN IP is the default.
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
