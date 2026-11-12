import { asId } from '@unbound-plugins/shared/values/as-id';

export type GuildSheetProps = {
	guild?: { id?: unknown } | null;
	guildId?: unknown;
};

export type MenuItem = {
	label?: string;
	IconComponent?: unknown;
	action?: () => void;
};

/**
 * @description Recognizes a server's action sheet from the arguments Discord opened it with.
 * @param key The action sheet's key.
 * @param props The sheet's props.
 * @returns The server's ID, or `undefined` for any other sheet.
 */
export function guildSheetId(key: string, props: GuildSheetProps): string | undefined {
	if (!/^GuildActionSheet:/i.test(key)) return undefined;

	return asId(props.guild?.id) ?? asId(props.guildId) ?? asId(key.slice(key.indexOf(':') + 1));
}

/**
 * @description Adds an item to a context menu once.
 * @param items The menu's items.
 * @param item The item to add.
 * @returns `true` when the item was added, `false` when an item with its label was already there.
 */
export function addMenuItemOnce(items: MenuItem[], item: MenuItem): boolean {
	if (items.some((entry) => entry.label === item.label)) return false;

	items.push(item);

	return true;
}

export default { guildSheetId, addMenuItemOnce };
