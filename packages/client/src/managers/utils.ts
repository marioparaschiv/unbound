import { ManagerKind } from '~/lib/constants';
import { plugins } from '~/managers/plugins';
import { themes } from '~/managers/themes';
import { fonts } from '~/managers/fonts';
import { icons } from '~/managers/icons';

/**
 * @description Resolves the addon manager singleton for a given {@link ManagerKind}. Imports the leaf
 * manager modules directly (not the `~/managers` barrel) to avoid the builtins import cycle.
 * @param kind The manager kind to resolve.
 * @returns The matching manager singleton.
 */
export function getManager(
	kind: ManagerKind.Plugins | ManagerKind.Themes,
): typeof plugins | typeof themes;
export function getManager(kind: ManagerKind.Icons): typeof icons;
export function getManager(kind: ManagerKind.Fonts): typeof fonts;
export function getManager(
	kind: ManagerKind,
): typeof plugins | typeof themes | typeof icons | typeof fonts;
export function getManager(kind: ManagerKind) {
	switch (kind) {
		case ManagerKind.Themes:
			return themes;
		case ManagerKind.Icons:
			return icons;
		case ManagerKind.Fonts:
			return fonts;
		default:
			return plugins;
	}
}

export default { getManager };
