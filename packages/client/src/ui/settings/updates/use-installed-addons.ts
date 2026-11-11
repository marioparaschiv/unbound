import { ADDON_KINDS } from '@unbound-app/types/addons';
import { useEffect } from 'react';

import { installsFromManifest } from '~/addons/installs-from-manifest';
import { onRecordChange } from '~/ui/hooks/use-record-changes';
import type { InstalledEntry } from '~/updates/addon-updates';
import useForceUpdate from '~/ui/hooks/use-force-update';
import { Manager } from '~/addons/manager';

const KINDS = ADDON_KINDS.filter(installsFromManifest);

/**
 * @description Lists every installed addon the updater checks, re-rendering when one is installed,
 * updated or removed, or its updates are paused or resumed.
 * @returns The addons, sorted by name.
 */
function useInstalledAddons(): InstalledEntry[] {
	const forceUpdate = useForceUpdate();

	useEffect(() => {
		const offs = KINDS.flatMap((kind) => [
			Manager.for(kind).onInstalledChange(forceUpdate),
			onRecordChange(kind, ['held'], forceUpdate),
		]);

		return () => {
			for (const off of offs) off();
		};
	}, []);

	return KINDS.flatMap((kind) => Manager.for(kind).listInstalled()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

export default useInstalledAddons;
