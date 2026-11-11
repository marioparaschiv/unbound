import { createLogger } from '@unbound-app/logger';

import { canInstallHomeScreenIcon, canSyncAppIcons } from '~/native/unbound-native';
import type * as CustomIconsSheet from '~/ui/app-icons/open-custom-icons-sheet';
import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byFilePath } from '~/metro/filters';
import { icons } from '~/assets/api';
import { format } from '~/i18n/api';

import type { DiscordAppIcon, DiscordAppIconSelection, DiscordIconRow } from './bridge-icons';

import {
	findDiscordAppIcon,
	isDiscordIconRow,
	mergeDiscordAppIconRows,
	mergeDiscordAppIcons,
	resolveDiscordAppIconSelection,
	toDiscordAppIcon,
	toPickerAppIconId,
	unlockDiscordAppIcon,
} from './bridge-icons';
import AppIconStore from './state';

const APP_ICON_CONSTANTS = 'modules/app_icons/native/AppIconConstants.tsx';
const APP_ICON_UTILS = 'modules/app_icons/native/AppIconUtils.tsx';
const APP_ICON_ROWS = 'modules/app_icons/native/AppIconRows.tsx';
const APP_ICON_ROW = 'modules/app_icons/native/AppIconRow/AppIconRow.tsx';

const ADD_TILE_ID = 'UnboundAddCustomIcon';
const UNBOUND_ICON_ID = 'UnboundIcon';

const Patcher = createPatcher('unbound::app-icons');
const Logger = createLogger('AppIcons');

let stopWaiting: (() => void)[] = [];

function canAddCustomIcon(): boolean {
	return canSyncAppIcons() || canInstallHomeScreenIcon();
}

function usesHomeScreenIcon(): boolean {
	return !canSyncAppIcons() && canInstallHomeScreenIcon();
}

function discordIcons(): DiscordAppIcon[] {
	return AppIconStore.getState().icons.map(toDiscordAppIcon);
}

function addTile(): DiscordAppIcon {
	return {
		id: ADD_TILE_ID,
		nativeId: ADD_TILE_ID,
		name: format(
			usesHomeScreenIcon()
				? 'UNBOUND_APP_ICON_ADD_HOME_SCREEN_TILE'
				: 'UNBOUND_APP_ICON_ADD_TILE',
		),
		iconSource: icons.PlusLargeIcon,
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
		).map(unlockDiscordAppIcon),
	);

	// Discord gates every icon but the default behind Nitro; the picker's selection reads `isPremium` from here.
	Patcher.instead(constants, 'getIconById', ({ args, original, this: self }) => {
		const id = typeof args[0] === 'string' ? args[0] : undefined;
		const icon: unknown =
			(id === ADD_TILE_ID ? addTile() : findDiscordAppIcon(id, discordIcons())) ??
			original.apply(self, args);

		return isDiscordIconRow(icon) ? unlockDiscordAppIcon(icon) : icon;
	});
}

function patchUtils(utils: MetroExport) {
	Patcher.after(utils, 'setAppIcon', ({ args, result }) => {
		const id = args[0];

		if (typeof id === 'string' && result instanceof Promise) {
			result.then(
				(applied) => applied && AppIconStore.getState().setCurrent(id),
				() => {
					// Discord's caller reports the failed change.
				},
			);
		}

		return result;
	});

	// iOS reads `UIApplication.alternateIconName`, which can lag the change, so the applied id wins this launch.
	Patcher.after(utils, 'useCurrentAppIcon', ({ result }) => {
		const current = AppIconStore((state) => state.current);

		return current ?? result;
	});

	Patcher.after(utils, 'useAppIcons', ({ result }) => {
		const current = AppIconStore((state) => state.current);

		return current && result && typeof result === 'object'
			? { ...result, currentAppIcon: current }
			: result;
	});
}

type ElementProps = {
	icon?: DiscordAppIcon;
	trailing?: unknown;
	accessibilityRole?: string;
	accessibilityState?: unknown;
	icons?: DiscordIconRow[];
	currentAppIcon?: string;
	children?: Element | Element[];
	onSelect?: (...args: SelectArgs) => void;
};

type SelectArgs = [DiscordAppIconSelection];

type Element = { props?: ElementProps } | null | undefined;

function findRows(node: Element | Element[], found: Element[] = []): Element[] {
	if (!node || typeof node !== 'object') {
		return found;
	}

	if (Array.isArray(node)) {
		for (const child of node) findRows(child, found);

		return found;
	}

	if (Array.isArray(node.props?.icons)) {
		found.push(node);

		return found;
	}

	return findRows(node.props?.children, found);
}

function findTrailing(node: Element | Element[]): Element {
	if (!node || typeof node !== 'object') {
		return undefined;
	}

	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findTrailing(child);

			if (found) {
				return found;
			}
		}

		return undefined;
	}

	if (node.props && 'trailing' in node.props) {
		return node;
	}

	return findTrailing(node.props?.children);
}

function patchRow(row: MetroExport) {
	Patcher.after(row, 'default', ({ args, result }) => {
		const props = args[0] as ElementProps | undefined;

		if (props?.icon?.id !== ADD_TILE_ID) {
			return result;
		}

		const tile = findTrailing(result as Element);

		if (!tile?.props) {
			return result;
		}

		tile.props.trailing = undefined;
		tile.props.accessibilityRole = 'button';
		tile.props.accessibilityState = undefined;

		return result;
	});
}

function patchRows(rows: MetroExport) {
	Patcher.after(rows, 'default', ({ result }) => {
		const icons = AppIconStore((state) => state.icons)
			.map(toDiscordAppIcon)
			.sort((a, b) => Number(b.id === UNBOUND_ICON_ID) - Number(a.id === UNBOUND_ICON_ID));
		const leading = canAddCustomIcon() ? [addTile()] : [];
		const lists = findRows(result as Element);
		// Discord renders its official icons last, after any limited-time section.
		const official = lists.at(-1);

		if (!official?.props?.icons) {
			Logger.warn(
				'AppIconRows renders no icon list, so Unbound icons stay out of the picker.',
			);

			return result;
		}

		official.props.icons = mergeDiscordAppIconRows(
			official.props.icons,
			icons,
			leading,
			ADD_TILE_ID,
		);

		for (const list of lists) {
			if (!list?.props?.icons) {
				continue;
			}

			const onSelect = list.props.onSelect;

			list.props.icons = list.props.icons.map(unlockDiscordAppIcon);
			// Android reports the native alias the Unbound row replaces, so map it back to the row's id.
			list.props.currentAppIcon = toPickerAppIconId(list.props.currentAppIcon, icons);
			list.props.onSelect = (...args: SelectArgs) => {
				const selection = args[0];

				if (isAddTile(selection)) {
					// Required on use, so startup never evaluates the UI.
					const {
						openCustomIconsSheet,
					}: typeof CustomIconsSheet = require('~/ui/app-icons/open-custom-icons-sheet');

					openCustomIconsSheet().catch((error) =>
						Logger.error('Failed to open the custom app icon sheet:', error),
					);

					return;
				}

				onSelect?.(resolveDiscordAppIconSelection(selection, icons));
			};
		}

		return result;
	});
}

/**
 * @description Adds loader-provided app icons to Discord's native app icon picker.
 */
export function start(): void {
	if (!AppIconStore.getState().refresh().length && !canAddCustomIcon()) return;

	stopWaiting = [
		onModuleLoaded(byFilePath(APP_ICON_CONSTANTS), patchConstants),
		onModuleLoaded(byFilePath(APP_ICON_UTILS), patchUtils),
		onModuleLoaded(byFilePath(APP_ICON_ROWS), patchRows),
		onModuleLoaded(byFilePath(APP_ICON_ROW), patchRow),
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
