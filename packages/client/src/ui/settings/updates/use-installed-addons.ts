import { ADDON_KINDS } from '@unbound-app/types/addons';
import { useEffect } from 'react';

import type { InstalledEntry } from '~/updates/addon-updates';
import useForceUpdate from '~/ui/hooks/use-force-update';
import { installsFromManifest } from '~/addons/addons';
import { Manager } from '~/addons/manager';
import { onChange } from '~/storage/api';

const KINDS = ADDON_KINDS.filter(installsFromManifest);

/**
 * @description Lists every installed addon the updater checks, re-rendering when one is installed,
 * updated or removed, or its updates are paused or resumed.
 * @returns The addons, sorted by name.
 */
function useInstalledAddons(): InstalledEntry[] {
	const forceUpdate = useForceUpdate();

	useEffect(() => {
		const buckets = new Set(KINDS.map((kind) => Manager.for(kind).bucket));
		const offs = [
			...KINDS.map((kind) => Manager.for(kind).onInstalledChange(forceUpdate)),
			onChange(({ store, key }) => buckets.has(store) && key === 'held', forceUpdate),
		];

		return () => {
			for (const off of offs) off();
		};
	}, []);

	return KINDS.flatMap((kind) => Manager.for(kind).listInstalled()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

export default useInstalledAddons;
