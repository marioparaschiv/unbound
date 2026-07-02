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

/** Display name of the client, used as the settings section label. */
export const CLIENT_NAME = 'Unbound';

/** Short git revision this bundle was built from. Replaced at build time; `N/A` when git is unavailable. */
export const VERSION = '$$VERSION$$';

/** Route keys for every built-in Unbound settings screen. Values double as `SETTING_RENDERER_CONFIG` keys. */
export const Screens = {
	General: 'UNBOUND_GENERAL',
	Plugins: 'UNBOUND_PLUGINS',
	Design: 'UNBOUND_DESIGN',
	Developer: 'UNBOUND_DEVELOPER',
	Assets: 'UNBOUND_ASSETS',
	Toasts: 'UNBOUND_TOASTS',
	Marketplace: 'UNBOUND_MARKETPLACE',
	Custom: 'UNBOUND_CUSTOM',
} as const;

/** External links surfaced on the General settings page. */
export const SOCIAL_LINKS = {
	GitHub: 'https://github.com/unbound-mod',
	Docs: 'https://docs.unbound.rip/',
} as const;

/** Discord invite code for the support server, opened as a deep link from the General page. */
export const DISCORD_INVITE = 'rMdzhWUaGTx';

/** Discriminates which addon manager a UI surface (addon card/list) is bound to. */
export enum ManagerKind {
	Plugins,
	Themes,
}

/** Maps a {@link ManagerKind} to its manager export name on `~/managers`. */
export const ManagerNames: Record<ManagerKind, 'Plugins' | 'Themes'> = {
	[ManagerKind.Plugins]: 'Plugins',
	[ManagerKind.Themes]: 'Themes',
};
