import type { Addon } from '@unbound-app/types';
import { useEffect } from 'react';

import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';

import useForceUpdate from './use-force-update';

/** The manager kinds whose entities render as an addon list (Fonts are override targets, not addons). */
type AddonListKind = ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;

/**
 * @description Returns the entities of the manager for the given kind, re-rendering when they change.
 * @param kind The manager kind to read addons from.
 * @returns The current addon entities governed by that manager.
 */
function useAddons(kind: AddonListKind): Addon[] {
	const manager = getManager(kind);
	const forceUpdate = useForceUpdate();

	useEffect(() => {
		const events = [
			'loaded',
			'unloaded',
			'enabled',
			'disabled',
			'installed',
			'deleted',
		] as const;

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
