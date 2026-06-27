/** Build-time token replaced with a boolean literal by the `replace` plugin. */
declare const $$DEV$$: boolean;

export const CACHE_KEY = Symbol.for('metro.cache');
export const CACHE_VERSION = 1;

/** Whether this is a development build. Replaced at build time by the build's `transform.define`. */
export const DEV: boolean = $$DEV$$;

/**
 * Base URL the i18n locale tables are fetched from. Replaced at build time: the GitHub raw URL in
 * production, the local dev server (`UNBOUND_DEV=1`) otherwise.
 */
export const I18N_BASE_URL = '$$I18N_BASE_URL$$';

/**
 * `host:port` of the REPL/MCP debugger server (`@unbound-app/debugger`). Replaced at build time
 * with the dev host (so it tracks the same machine as the dev server). Empty in production.
 * Override the host with `DEV_HOST` / `--host`, or the whole value with `DEBUGGER_ADDRESS`.
 */
export const DEBUGGER_ADDRESS = '$$DEBUGGER_ADDRESS$$';
