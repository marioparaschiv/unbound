import { createLogger } from '@unbound-app/logger';

import { openCustomIconsSheet } from '~/ui/app-icons/open-custom-icons-sheet';
import { canSyncAppIcons } from '~/native/unbound-native';
import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byFilePath } from '~/metro/filters';
import { format } from '~/i18n/api';

import type { DiscordAppIcon, DiscordAppIconSelection, DiscordIconRow } from './bridge-icons';

import {
	findDiscordAppIcon,
	isDiscordIconRow,
	mergeDiscordAppIconRows,
	mergeDiscordAppIcons,
	resolveDiscordAppIconSelection,
	toDiscordAppIcon,
} from './bridge-icons';
import { ADD_TILE_IMAGE } from './add-tile-image';
import AppIconStore from './state';

const APP_ICON_CONSTANTS = 'modules/app_icons/native/AppIconConstants.tsx';
const APP_ICON_ROWS = 'modules/app_icons/native/AppIconRows.tsx';

const ADD_TILE_ID = 'UnboundAddCustomIcon';
const UNBOUND_ICON_ID = 'UnboundIcon';

const Patcher = createPatcher('unbound::app-icons');
const Logger = createLogger('AppIcons');

let stopWaiting: (() => void)[] = [];

function discordIcons(): DiscordAppIcon[] {
	return AppIconStore.getState().icons.map(toDiscordAppIcon);
}

function addTile(): DiscordAppIcon {
	return {
		id: ADD_TILE_ID,
		nativeId: ADD_TILE_ID,
		name: format('UNBOUND_APP_ICON_ADD_TILE'),
		iconSource: { uri: ADD_TILE_IMAGE },
		isPremium: false,
	};
}

function isAddTile(selection: DiscordAppIconSelection): boolean {
	return (typeof selection === 'string' ? selection : selection.id) === ADD_TILE_ID;
}

function patchConstants(constants: MetroExport) {
	if (typeof constants.getIcons !== 'function' || typeof constants.getIconById !== 'function') {
		Logger.warn(
			'AppIconConstants has no getIcons or getIconById, so Unbound icons stay out of the picker.',
		);

		return;
	}

	Patcher.after(constants, 'getIcons', ({ result }) =>
		mergeDiscordAppIcons(
			Array.isArray(result) ? result.filter(isDiscordIconRow) : [],
			discordIcons(),
		),
	);

	Patcher.instead(constants, 'getIconById', ({ args, original, this: self }) => {
		const id = typeof args[0] === 'string' ? args[0] : undefined;
		const icon = id === ADD_TILE_ID ? addTile() : findDiscordAppIcon(id, discordIcons());

		return icon ?? original.apply(self, args);
	});
}

type ElementProps = {
	icons?: DiscordIconRow[];
	children?: Element | Element[];
	onSelect?: (...args: SelectArgs) => void;
};

type SelectArgs = [DiscordAppIconSelection];

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
		const icons = AppIconStore((state) => state.icons)
			.map(toDiscordAppIcon)
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

		const onSelect = list.props.onSelect;

		list.props.icons = mergeDiscordAppIconRows(shown, icons, leading, ADD_TILE_ID);
		list.props.onSelect = (...args: SelectArgs) => {
			const selection = args[0];

			if (isAddTile(selection)) {
				openCustomIconsSheet().catch((error) =>
					Logger.error('Failed to open the custom app icon sheet:', error),
				);

				return;
			}

			onSelect?.(resolveDiscordAppIconSelection(selection, icons));
		};

		return result;
	});
}

/**
 * @description Adds loader-provided app icons to Discord's native app icon picker.
 */
export function start(): void {
	if (!AppIconStore.getState().refresh().length && !canSyncAppIcons()) return;

	stopWaiting = [
		onModuleLoaded(byFilePath(APP_ICON_CONSTANTS), patchConstants),
		onModuleLoaded(byFilePath(APP_ICON_ROWS), patchRows),
	];
}

/**
 * @description Removes the loader's app icon picker patches.
 */
export function stop(): void {
	for (const stop of stopWaiting) stop();

	stopWaiting = [];

	Patcher.unpatchAll();
}

export default { start, stop };
