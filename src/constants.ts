export const Invite = 'enmityapp' as const;

export const Links = {
	GitHub: 'https://github.com/enmity-mod',
	Twitter: 'https://twitter.com/EnmityApp',
	Bundle: 'https://raw.githubusercontent.com/enmity-mod/enmity/main/dist/bundle.js',
	Badges: 'https://raw.githubusercontent.com/enmity-mod/badges/main/'
} as const;

export const Screens = {
	General: 'ENMITY_GENERAL',
	Plugins: 'ENMITY_PLUGINS',
	Themes: 'ENMITY_THEMES',
	Updater: 'ENMITY_UPDATER',
	Custom: 'CUSTOM'
} as const;

export const Times = {
	HOUR: 60 * 60 * 1000
} as const;

export const Regex = {
	SemanticVersioning: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/i,
	URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i
} as const;
