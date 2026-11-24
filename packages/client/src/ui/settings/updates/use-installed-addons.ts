import { ADDON_KINDS } from '@unbound-app/types/addons';
import { useEffect, useState } from 'react';

import { installsFromManifest } from '~/addons/installs-from-manifest';
import { onRecordChange } from '~/ui/hooks/use-record-changes';
import type { InstalledEntry } from '~/updates/addon-updates';
import { Manager } from '~/addons/manager';

const KINDS = ADDON_KINDS.filter(installsFromManifest);

function listAll(): InstalledEntry[] {
	return KINDS.flatMap((kind) => Manager.for(kind).listInstalled()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

/**
 * @description Lists every installed addon the updater checks, re-listing when one is installed,
 * updated or removed, or its updates are paused or resumed.
 * @returns The addons, sorted by name; the same array until one of those changes.
 */
function useInstalledAddons(): InstalledEntry[] {
	// Listed once per change, not per render: the page re-renders on every store update while it loads.
	const [addons, setAddons] = useState(listAll);

	useEffect(() => {
		function handler() {
			setAddons(listAll());
		}

		const offs = KINDS.flatMap((kind) => [
			Manager.for(kind).onInstalledChange(handler),
			onRecordChange(kind, ['held'], handler),
		]);

		return () => {
			for (const off of offs) off();
		};
	}, []);

	return addons;
}

export default useInstalledAddons;
