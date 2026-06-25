/** Build-time token replaced with a boolean literal by the `replace` plugin. */
declare const $$DEV$$: boolean;

export const CACHE_KEY = Symbol.for('metro.cache');
export const CACHE_VERSION = 1;

/** Whether this is a development build. Replaced at build time by the `replace` plugin. */
export const DEV: boolean = $$DEV$$;

/**
 * Base URL the i18n locale tables are fetched from. Replaced at build time: the GitHub raw URL in
 * production, the local dev server (`UNBOUND_DEV=1`) otherwise.
 */
export const I18N_BASE_URL = '$$I18N_BASE_URL$$';

/**
 * Origin of the local `serve` dev server (locale tables + hot-reload stream). Replaced at build
 * time; only used by dev builds. Override with `DEV_SERVER_URL` for a physical device on the LAN.
 */
export const DEV_SERVER_URL = '$$DEV_SERVER_URL$$';
