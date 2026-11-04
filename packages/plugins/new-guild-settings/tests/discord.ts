import { flux, metro, startPlugin } from '@unbound-app/api/testing';

// UNKNOWN: a test sends Discord's action payloads, which FluxAction does not type.
export type Action = { type: string } & Record<string, unknown>;

export type Update = Record<string, unknown>;

export const ME = '1';

export const applied: { guildId: string; update: Update }[] = [];
export const toggled: string[] = [];
export const hidden: string[] = [];
export const hiddenMenus: number[] = [];

export const guildActions = {
	joinGuild: async (..._args: unknown[]) => undefined,
	waitForGuild: async () => undefined,
};

export const sheets = {
	openLazy: (_sheet: Promise<unknown>, _key: string, _props: unknown) => {},
	hideActionSheet: (key: string) => void hidden.push(key),
};

export const contextMenus = {
	showContextMenu: (_menu?: { key?: unknown; items?: unknown[] }) => {},
	hideContextMenu: () => void hiddenMenus.push(hiddenMenus.length),
};

// A module Discord changed so that its method cannot be read, which a patch on it throws on.
const BrokenContextMenus = {
	get showContextMenu(): never {
		throw new Error('The menu module changed shape.');
	},
	hideContextMenu: () => {},
};

export function dispatch(action: Action) {
	return flux.dispatch(action);
}

/** Registers the Discord modules the plugin patches (leaving out the context menus when asked), seeds the stores it reads and starts the plugin. */
export async function startGuildSettings(optIn = false, brokenContextMenus = false) {
	applied.length = 0;
	toggled.length = 0;
	hidden.length = 0;
	hiddenMenus.length = 0;

	metro.register({
		updateGuildNotificationSettings: (guildId: string, update: Update) =>
			void applied.push({ guildId, update }),
	});
	metro.register({ toggleShowAllChannels: (guildId: string) => void toggled.push(guildId) });
	metro.register(guildActions);
	metro.register(sheets);
	metro.register(brokenContextMenus ? BrokenContextMenus : contextMenus);
	metro.register({ SettingsIcon: () => null });
	flux.seed({
		User: { getCurrentUser: () => ({ id: ME }) },
		UserGuildSettings: { isOptInEnabled: () => optIn },
		Guild: {
			getGuild: (id: string) => (id === '100' ? { id, name: 'Wumpus Den' } : undefined),
		},
	});

	await startPlugin();
}
