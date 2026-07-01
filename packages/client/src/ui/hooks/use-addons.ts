import type { Addon } from '@unbound-app/types';
import { useEffect } from 'react';

import { ManagerKind, ManagerNames } from '~/lib/constants';
import { Plugins, Themes } from '~/managers';

import useForceUpdate from './use-force-update';

const Managers = { Plugins, Themes };

/**
 * @description Returns the entities of the manager for the given kind, re-rendering when they change.
 * @param kind The manager kind to read addons from.
 * @returns The current addon entities governed by that manager.
 */
function useAddons(kind: ManagerKind): Addon[] {
	const manager = Managers[ManagerNames[kind]];
	const forceUpdate = useForceUpdate();

	useEffect(() => {
		const events = ['loaded', 'unloaded', 'enabled', 'disabled'] as const;

		for (const event of events) {
			manager.on(event, forceUpdate);
		}

		return () => {
			for (const event of events) {
				manager.off(event, forceUpdate);
			}
		};
	}, [manager]);

	return manager.getEntities();
}

export default useAddons;
