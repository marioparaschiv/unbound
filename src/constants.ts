export const CLIENT_NAME = 'Unbound';
export const CACHE_KEY = Symbol.for('metro.cache');
export const CACHE_VERSION = 1;

export enum ManagerKind {
	PLUGINS,
	THEMES,
	ICONS,
	FONTS,
	SOURCES
}

export enum ManagerType {
	BASE,
	ADDON
}

export const ManagerNames = {
	[ManagerKind.PLUGINS]: 'Plugins',
	[ManagerKind.THEMES]: 'Themes',
	[ManagerKind.ICONS]: 'Icons',
	[ManagerKind.SOURCES]: 'Sources'
};

export const ManagerEntity = {
	[ManagerKind.PLUGINS]: 'plugin',
	[ManagerKind.THEMES]: 'theme',
	[ManagerKind.ICONS]: 'icon-pack',
};

export const ManagerEntityNames = {
	[ManagerKind.PLUGINS]: 'Plugin',
	[ManagerKind.THEMES]: 'Theme',
	[ManagerKind.ICONS]: 'Icon Pack',
};

export const DISCORD_INVITE = 'unboundapp' as const;

export const DefaultSources = [
	'http://github.com/unbound-mod/sources/test'
];

export const SocialLinks = {
	GitHub: 'https://github.com/unbound-mod',
	Bundle: 'https://raw.githubusercontent.com/unbound-mod/builds/main/unbound.js',
	Badges: 'https://raw.githubusercontent.com/unbound-mod/badges/main/',
	Docs: 'https://docs.unbound.rip/',
	OnboardingPlugin: 'http://rosies-macbook-air.local:5495/manifest.json'
} as const;


export enum DispatchTypes {
	REGISTER_SETTINGS_ENTRIES = 'UB_REGISTER_SETTINGS_ENTRIES'
}

export const Screens = {
	General: 'UNBOUND_GENERAL',
	Plugins: 'UNBOUND_PLUGINS',
	Design: 'UNBOUND_DESIGN',
	Marketplace: 'UNBOUND_MARKETPLACE',
	Developer: 'UNBOUND_DEVELOPER',
	Toasts: 'UNBOUND_TOASTS',
	Logs: 'UNBOUND_LOGS',
	Assets: 'UNBOUND_ASSETS',
	Custom: 'UNBOUND_CUSTOM'
} as const;

export const Times = {
	HOUR: 60 * 60 * 1000
} as const;

export const Regex = {
	SemanticVersioning: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/i,
	URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i
} as const;
