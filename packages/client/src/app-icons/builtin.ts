import type { UnboundAppIcon } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import { openCustomIconsSheet } from '~/ui/app-icons/open-custom-icons-sheet';
import { canSyncAppIcons } from '~/native/unbound-native';
import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byFilePath } from '~/metro/filters';
import { format } from '~/i18n/api';

import { ADD_TILE_IMAGE } from './add-tile-image';
import AppIconStore from './state';

const APP_ICON_CONSTANTS = 'modules/app_icons/native/AppIconConstants.tsx';
const APP_ICON_ROWS = 'modules/app_icons/native/AppIconRows.tsx';

const ADD_TILE_ID = 'UnboundAddCustomIcon';
const UNBOUND_ICON_ID = 'UnboundIcon';

const Patcher = createPatcher('unbound::app-icons');
const Logger = createLogger('AppIcons');

type DiscordAppIcon = {
	id: string;
	name: string;
	iconSource: unknown;
	isPremium: boolean;
};

let stopWaiting: (() => void)[] = [];

function toDiscordIcon(icon: UnboundAppIcon): DiscordAppIcon {
	return { id: icon.id, name: icon.name, iconSource: { uri: icon.image }, isPremium: false };
}

function discordIcons(): DiscordAppIcon[] {
	return AppIconStore.getState().icons.map(toDiscordIcon);
}

function addTile(): DiscordAppIcon {
	return {
		id: ADD_TILE_ID,
		name: format('UNBOUND_APP_ICON_ADD_TILE'),
		iconSource: { uri: ADD_TILE_IMAGE },
		isPremium: false,
	};
}

// UNKNOWN: Discord's picker passes either the icon or its id to `onSelect`, depending on the build.
function isAddTile(selection: unknown): boolean {
	const id =
		typeof selection === 'object' && selection !== null && 'id' in selection
			? selection.id
			: selection;

	return id === ADD_TILE_ID;
}

function patchConstants(constants: MetroExport) {
	if (typeof constants.getIcons !== 'function' || typeof constants.getIconById !== 'function') {
		Logger.warn(
			'AppIconConstants has no getIcons or getIconById, so Unbound icons stay out of the picker.',
		);

		return;
	}

	Patcher.after(constants, 'getIcons', ({ result }) => [
		...(Array.isArray(result) ? result : []),
		...discordIcons(),
	]);

	Patcher.instead(constants, 'getIconById', ({ args, original, this: self }) => {
		const icon =
			args[0] === ADD_TILE_ID ? addTile() : discordIcons().find(({ id }) => id === args[0]);

		return icon ?? original.apply(self, args);
	});
}

type ElementProps = {
	icons?: DiscordAppIcon[];
	children?: Element | Element[];
	onSelect?: (...args: SelectArgs) => void;
};

// UNKNOWN: the picker's selection arguments are Discord's and differ between builds.
type SelectArgs = unknown[];

type Element = { props?: ElementProps } | null | undefined;

function findRows(node: Element | Element[]): Element {
	if (!node || typeof node !== 'object') {
		return undefined;
	}

	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findRows(child);

			if (found) {
				return found;
			}
		}

		return undefined;
	}

	if (Array.isArray(node.props?.icons)) {
		return node;
	}

	return findRows(node.props?.children);
}

function patchRows(rows: MetroExport) {
	Patcher.after(rows, 'default', ({ result }) => {
		// The rows component calls this on every render, so the store hook keeps a stable order.
		const icons = AppIconStore((state) => state.icons)
			.map(toDiscordIcon)
			.sort((a, b) => Number(b.id === UNBOUND_ICON_ID) - Number(a.id === UNBOUND_ICON_ID));
		const leading = canSyncAppIcons() ? [addTile()] : [];
		const list = findRows(result as Element);
		const shown = list?.props?.icons;

		if (!list?.props || !shown) {
			Logger.warn(
				'AppIconRows renders no icon list, so Unbound icons stay out of the picker.',
			);

			return result;
		}

		const missing = icons.filter((icon) => !shown.some((entry) => entry.id === icon.id));
		const rest = shown.filter((icon) => icon.id !== ADD_TILE_ID);
		const onSelect = list.props.onSelect;

		list.props.icons = [...leading, rest[0], ...missing, ...rest.slice(1)].filter(Boolean);
		list.props.onSelect = (...args: SelectArgs) => {
			if (isAddTile(args[0])) {
				openCustomIconsSheet().catch((error) =>
					Logger.error('Failed to open the custom app icon sheet:', error),
				);

				return;
			}

			onSelect?.(...args);
		};

		return result;
	});
}

/**
 * @description Lists the app icons the loader provides, such as Unbound's and the user's custom ones, in Discord's own
 * app icon picker, with a tile that adds or removes custom icons where the loader can install them.
 */
export function start() {
	if (!AppIconStore.getState().refresh().length && !canSyncAppIcons()) return;

	stopWaiting = [
		onModuleLoaded(byFilePath(APP_ICON_CONSTANTS), patchConstants),
		onModuleLoaded(byFilePath(APP_ICON_ROWS), patchRows),
	];
}

/** Removes the loader's app icons from Discord's app icon picker. */
export function stop() {
	for (const stop of stopWaiting) stop();

	stopWaiting = [];

	Patcher.unpatchAll();
}

export default { start, stop };
