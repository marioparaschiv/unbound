export const Invite = 'unboundapp' as const;

export const Links = {
	GitHub: 'https://github.com/unbound-mod',
	Twitter: 'https://twitter.com/UnboundApp',
	Bundle: 'https://raw.githubusercontent.com/unbound-mod/unbound/main/dist/bundle.js',
	Badges: 'https://raw.githubusercontent.com/unbound-mod/badges/main/'
} as const;

export const ClientName = 'Unbound';

export const Keys = {
	General: 'UNBOUND_GENERAL',
	Plugins: 'UNBOUND_PLUGINS',
	Themes: 'UNBOUND_THEMES',
	Updater: 'UNBOUND_UPDATER',
	Custom: 'UNBOUND_CUSTOM'
} as const;

export const Paths = {
	packs: {
		local: `${ClientName}/Packs`,
		base: 'https://github.com/acquitelol/rosiecord/tree/master/Packs',
		raw: 'https://raw.githubusercontent.com/acquitelol/rosiecord/master/Packs',
	}
} as const;

export const Times = {
	HOUR: 60 * 60 * 1000
} as const;

export const Regex = {
	SemanticVersioning: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/i,
	URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i
} as const;
