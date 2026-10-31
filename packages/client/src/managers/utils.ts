import type { ManagerKind } from '@unbound-app/types/addons';

import type { Manager } from '~/managers/base';
import { plugins } from '~/managers/plugins';
import { themes } from '~/managers/themes';
import { fonts } from '~/managers/fonts';
import { icons } from '~/managers/icons';

/**
 * The addon manager singleton of every {@link ManagerKind}, in start order. Imports the leaf manager
 * modules directly (not the `~/managers` barrel) to avoid the builtins import cycle.
 */
export const managers = {
	plugins,
	themes,
	icons,
	fonts,
} satisfies Record<ManagerKind, Pick<Manager<never>, 'type' | 'initialize' | 'shutdown'>>;

/**
 * @description Resolves the addon manager singleton for a given {@link ManagerKind}.
 * @template K The manager kind.
 * @param kind The manager kind to resolve.
 * @returns The matching manager singleton.
 */
export function getManager<K extends ManagerKind>(kind: K): (typeof managers)[K] {
	return managers[kind];
}

export default { managers, getManager };
