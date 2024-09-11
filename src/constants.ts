export const CACHE_KEY: unique symbol = Symbol.for('metro.cache');
export const CACHE_VERSION = 1 as const;

export const DISCORD_INVITE = 'unboundapp' as const;

export const SOCIAL_LINKS = {
	GitHub: 'https://github.com/unbound-mod',
	Bundle: 'https://raw.githubusercontent.com/unbound-mod/unbound/main/dist/bundle.js',
	Badges: 'https://raw.githubusercontent.com/unbound-mod/badges/main/',
	Docs: 'https://docs.unbound.rip/',
	OnboardingPlugin: 'http://rosies-macbook-air.local:5495/manifest.json'
} as const;

export const CLIENT_NAME = 'Unbound';

export const DISPATCH_TYPES = {
	REGISTER_SETTINGS_ENTRIES: 'UB_REGISTER_SETTINGS_ENTRIES'
};

export const SETTINGS_KEYS = {
	General: 'UNBOUND_GENERAL',
	Plugins: 'UNBOUND_PLUGINS',
	Design: 'UNBOUND_DESIGN',
	Sources: 'UNBOUND_SOURCES',
	Custom: 'UNBOUND_CUSTOM'
} as const;

export const TIMES = {
	HOUR: 60 * 60 * 1000
} as const;

export const REGEX = {
	SemanticVersioning: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/i,
	URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i
} as const;
