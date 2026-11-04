import { extendApi, flux, metro } from '@unbound-app/api/testing';

// Lookups stay resolved across test files, so every file shares these modules.
export const opened: unknown[] = [];
export const hidden: string[] = [];

// The media viewer is a module of functions, which the kit's component fakes do not give.
export function registerMedia() {
	extendApi('metro.components.Media', {
		openMediaModal: (options: unknown) => void opened.push(options),
	});
}

export const ContextMenus = {
	showContextMenu: (_menu?: unknown) => {},
	hideContextMenu: () => void hidden.push('menu'),
};

export const ActionSheets = {
	openLazy: (_sheet?: Promise<unknown>, _key?: unknown, _props?: unknown) => {},
	hideActionSheet: (key: string) => void hidden.push(key),
};

// A module Discord changed so that its method cannot be read, which a patch on it throws on.
const BrokenContextMenus = {
	get showContextMenu(): never {
		throw new Error('The menu module changed shape.');
	},
	hideContextMenu: () => {},
};

const IconUtils = {
	getUserAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/abc.png',
	getUserBannerURL: () => 'https://cdn.discordapp.com/banners/1/def.png',
	getGuildIconURL: () => 'https://cdn.discordapp.com/icons/2/ghi.png',
	getGuildBannerURL: () => null,
	getChannelIconURL: () => null,
	getGuildMemberAvatarURLSimple: () => null,
};

export function registerDiscord({ brokenContextMenus = false } = {}) {
	opened.length = 0;
	hidden.length = 0;
	registerMedia();
	metro.register(brokenContextMenus ? BrokenContextMenus : ContextMenus);
	metro.register(ActionSheets);
	metro.register(IconUtils);
	metro.register({ colors: { TEXT_DEFAULT: '#fff' }, internal: {} });
	flux.seed({
		Channel: { getChannel: () => undefined },
		GuildMember: { getMember: () => null },
		UserProfile: { getUserProfile: () => null, getGuildMemberProfile: () => null },
		User: { getUser: (id: string) => ({ id, avatar: 'abc', banner: 'def' }) },
		Guild: { getGuild: () => undefined },
	});
}
