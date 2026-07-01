import { ManagerKind } from '~/lib/constants';
import { plugins } from '~/managers/plugins';
import { themes } from '~/managers/themes';

/**
 * @description Resolves the addon manager singleton for a given {@link ManagerKind}. Imports the leaf
 * manager modules directly (not the `~/managers` barrel) to avoid the builtins import cycle.
 * @param kind The manager kind to resolve.
 * @returns The matching manager singleton.
 */
export function getManager(kind: ManagerKind) {
	return kind === ManagerKind.Themes ? themes : plugins;
}

export default { getManager };
