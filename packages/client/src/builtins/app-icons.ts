import type { UnboundAppIcon } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import { createPatcher } from '~/patcher/create-patcher';
import { getAppIcons } from '~/native/unbound-native';
import { byFilePath } from '~/metro/filters';
import { onModuleLoaded } from '~/metro/wait';

const APP_ICON_CONSTANTS = 'modules/app_icons/native/AppIconConstants.tsx';
const APP_ICON_ROWS = 'modules/app_icons/native/AppIconRows.tsx';

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

function patchConstants(constants: MetroExport, icons: DiscordAppIcon[]) {
	if (typeof constants.getIcons !== 'function' || typeof constants.getIconById !== 'function') {
		Logger.warn('AppIconConstants has no getIcons or getIconById, so Unbound icons stay out of the picker.');

		return;
	}

	Patcher.after(constants, 'getIcons', ({ result }) => [
		...(Array.isArray(result) ? result : []),
		...icons,
	]);

	Patcher.instead(constants, 'getIconById', ({ args, original, this: self }) => {
		return icons.find((icon) => icon.id === args[0]) ?? original.apply(self, args);
	});
}

type Element = { type?: unknown; props?: Record<string, unknown> } | null | undefined;

function findRows(node: Element | Element[]): Element {
	if (!node || typeof node !== 'object') return undefined;
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findRows(child);

			if (found) return found;
		}

		return undefined;
	}
	if (Array.isArray(node.props?.icons)) return node;

	return findRows(node.props?.children as Element | Element[]);
}

function patchRows(rows: MetroExport, icons: DiscordAppIcon[]) {
	Patcher.after(rows, 'default', ({ result }) => {
		const list = findRows(result as Element);
		const shown = list?.props?.icons as DiscordAppIcon[] | undefined;

		if (!list?.props || !shown) {
			Logger.warn('AppIconRows renders no icon list, so Unbound icons stay out of the picker.');

			return result;
		}

		const missing = icons.filter((icon) => !shown.some((entry) => entry.id === icon.id));

		list.props.icons = [shown[0], ...missing, ...shown.slice(1)].filter(Boolean);

		return result;
	});
}

/** Lists the app icons the loader provides, such as Unbound's, in Discord's own app icon picker. */
export function start() {
	const icons = getAppIcons().map(toDiscordIcon);

	if (!icons.length) return;

	stopWaiting = [
		onModuleLoaded(byFilePath(APP_ICON_CONSTANTS), (constants) => patchConstants(constants, icons)),
		onModuleLoaded(byFilePath(APP_ICON_ROWS), (rows) => patchRows(rows, icons)),
	];
}

/** Removes the loader's app icons from Discord's app icon picker. */
export function stop() {
	for (const stop of stopWaiting) stop();
	stopWaiting = [];

	Patcher.unpatchAll();
}

export default { start, stop };
