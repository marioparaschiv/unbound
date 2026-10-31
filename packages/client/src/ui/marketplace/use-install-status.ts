import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { useEffect } from 'react';

import type { InstallStatus } from '~/lib/catalog';
import { getInstallStatus } from '~/lib/catalog';
import { useForceUpdate } from '~/ui/hooks';
import { Manager } from '~/managers/base';

import { getInstalledVersion, INSTALL_EVENTS } from './targets';

/**
 * @description Compares a listed addon with the installed copy, re-rendering when the manager changes.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @returns Whether the card offers an install, an update, or neither.
 */
function useInstallStatus(kind: AddonKind, addon: ListedAddon): InstallStatus {
	const forceUpdate = useForceUpdate();

	useEffect(() => {
		if (kind === 'font') {
			const fonts = Manager.for(kind);

			fonts.on('changed', forceUpdate);

			return () => void fonts.off('changed', forceUpdate);
		}

		const manager = Manager.for(kind);

		for (const event of INSTALL_EVENTS) {
			manager.on(event, forceUpdate);
		}

		return () => {
			for (const event of INSTALL_EVENTS) {
				manager.off(event, forceUpdate);
			}
		};
	}, [kind]);

	return getInstallStatus(addon.latestVersion.version, getInstalledVersion(kind, addon));
}

export default useInstallStatus;
