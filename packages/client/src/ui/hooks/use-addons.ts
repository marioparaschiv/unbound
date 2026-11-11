import { useEffect } from 'react';

import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';

import useForceUpdate from './use-force-update';

/** The manager kinds whose addons render as an addon list (Fonts are override targets, not addons). */
type AddonListKind = 'plugin' | 'theme' | 'icon-pack';

/**
 * @description Returns the addons of the manager for the given kind, re-rendering when they change.
 * @param kind The manager kind to read addons from.
 * @returns The current addons governed by that manager.
 */
function useAddons(kind: AddonListKind): Addon[] {
	const manager = Manager.for(kind);
	const forceUpdate = useForceUpdate();

	useEffect(() => {
		const events = [
			'loaded',
			'unloaded',
			'enabled',
			'disabled',
			'installed',
			'uninstalled',
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

	return manager.getAddons();
}

export default useAddons;
