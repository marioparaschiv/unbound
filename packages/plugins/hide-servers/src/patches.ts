import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { formatIdList, parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { asId } from '@unbound-plugins/shared/values/as-id';
import { flux, metro, patcher, toasts } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { format, messages } from '@unbound-app/i18n';

import {
	type GuildBarNode,
	type GuildsTree,
	treeWithoutHiddenGuilds,
	withoutHiddenGuilds,
} from '~/lib/hidden-guilds';

type MenuItem = {
	label?: string;
	IconComponent?: unknown;
	action?: () => void;
};

type ContextMenu = {
	key?: unknown;
	items?: MenuItem[];
};

type ContextMenuHost = {
	showContextMenu: (menu?: ContextMenu) => void;
	hideContextMenu: () => void;
};

type GuildSheetProps = {
	guild?: { id?: unknown } | null;
	guildId?: unknown;
};

const SortedGuildStore = flux.getStore('SortedGuild');
const GuildStore = flux.getStore('Guild');

type Filtered<T> = { source: T; hidden: string; value: T };

const cache = new Map<string, Filtered<unknown>>();

function filterOnce<T>(
	method: string,
	source: T,
	filter: (source: T, hidden: Set<string>) => T,
): T {
	const cached = cache.get(method) as Filtered<T> | undefined;

	if (cached?.source === source && cached.hidden === settings.hidden) return cached.value;

	const value = filter(source, new Set(parseIdList(settings.hidden)));

	cache.set(method, { source, hidden: settings.hidden, value });

	return value;
}

function isNodeList(value: unknown): value is readonly GuildBarNode[] {
	return Array.isArray(value) && value.every((node) => typeof node === 'object' && node !== null);
}

function isGuildsTree(value: unknown): value is GuildsTree {
	return Boolean(value && typeof value === 'object' && 'root' in value && 'nodes' in value);
}

function guildSheetId(key: string, props: GuildSheetProps): string | undefined {
	if (!/^GuildActionSheet:/i.test(key)) return undefined;

	return asId(props.guild?.id) ?? asId(props.guildId) ?? asId(key.slice(key.indexOf(':') + 1));
}

/**
 * @description Saves the hidden servers and redraws the server list without them.
 * @param ids The ids of the servers to hide.
 */
export function setHiddenGuilds(ids: readonly string[]): void {
	settings.hidden = formatIdList([...ids]);
	SortedGuildStore.emitChange();
}

function hideGuild(guildId: string): void {
	setHiddenGuilds([...new Set([...parseIdList(settings.hidden), guildId])]);

	const name = GuildStore.getGuild(guildId)?.name;

	if (name) toasts.show({ title: addon.name, content: format('HIDDEN_SERVER', { name }) });
}

/**
 * @description Leaves hidden servers out of the server tree the server bar draws and the folder list it scrolls by, on `SortedGuildStore`.
 */
export function patchGuildBar(): void {
	patcher.after(SortedGuildStore, 'getGuildsTree', ({ result }) =>
		isGuildsTree(result) ? filterOnce('tree', result, treeWithoutHiddenGuilds) : result,
	);
	patcher.after(SortedGuildStore, 'getFastListGuildFolders', ({ result }) =>
		isNodeList(result) ? filterOnce('folders', result, withoutHiddenGuilds) : result,
	);
	SortedGuildStore.emitChange();
}

/**
 * @description Adds a Hide Server row to each server's long-press action sheet.
 */
export function patchGuildSheet(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Hide Server row skipped: Discord moved its action sheets.');

		return;
	}

	let open: { key: string; guildId: string } | undefined;

	const { render } = createSheetRenderer(patcher, (result) => {
		const current = open;

		if (!current) return;

		insertSheetRows(result, [
			{
				key: 'hide-servers',
				label: messages.HIDE_SERVER,
				icon: 'EyeSlashIcon',
				onPress: () => {
					ActionSheets.hideActionSheet(current.key);
					hideGuild(current.guildId);
				},
			},
		]);
	});

	patchLazySheets<GuildSheetProps>(patcher, ActionSheets, (key, props) => {
		const guildId = guildSheetId(key, props);

		open = guildId ? { key, guildId } : undefined;

		return guildId ? render : undefined;
	});
}

/**
 * @description Adds a Hide Server item to each server's context menu, which Android opens on long-press.
 */
export function patchGuildMenu(): void {
	const ContextMenus: ContextMenuHost | undefined = metro.findByProps(
		'showContextMenu',
		'hideContextMenu',
	);
	const Icons = metro.findByProps('EyeSlashIcon');

	if (!ContextMenus || !Icons) {
		logger.warn('Hide Server item skipped: Discord moved showContextMenu or EyeSlashIcon.');

		return;
	}

	patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
		const guildId = asId(menu?.key);

		if (!menu || !Array.isArray(menu.items) || !guildId || !GuildStore.getGuild(guildId))
			return;
		if (menu.items.some((item) => item.label === messages.HIDE_SERVER)) return;

		menu.items.push({
			label: messages.HIDE_SERVER,
			IconComponent: Icons.EyeSlashIcon,
			action: () => {
				ContextMenus.hideContextMenu();
				hideGuild(guildId);
			},
		});
	});
}

/**
 * @description Redraws the server list with every hidden server back in it.
 */
export function restoreGuildBar(): void {
	cache.clear();
	SortedGuildStore.emitChange();
}
