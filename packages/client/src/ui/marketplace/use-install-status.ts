import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { useEffect } from 'react';

import { getInstalledVersion } from '~/marketplace/install';
import type { InstallStatus } from '~/marketplace/catalog';
import { getInstallStatus } from '~/marketplace/catalog';
import useForceUpdate from '~/ui/hooks/use-force-update';
import { Manager } from '~/addons/manager';

/**
 * @description Compares a listed addon with the installed copy, re-rendering when the manager changes.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @returns Whether the card offers an install, an update, or neither.
 */
function useInstallStatus(kind: AddonKind, addon: ListedAddon): InstallStatus {
	const forceUpdate = useForceUpdate();

	useEffect(() => Manager.for(kind).onInstalledChange(forceUpdate), [kind]);

	return getInstallStatus(addon.latestVersion.version, getInstalledVersion(kind, addon));
}

export default useInstallStatus;
