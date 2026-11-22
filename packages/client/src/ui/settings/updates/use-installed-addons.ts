import { ADDON_KINDS } from '@unbound-app/types/addons';
import { useEffect, useMemo, useReducer } from 'react';

import { installsFromManifest } from '~/addons/installs-from-manifest';
import { onRecordChange } from '~/ui/hooks/use-record-changes';
import type { InstalledEntry } from '~/updates/addon-updates';
import { Manager } from '~/addons/manager';

const KINDS = ADDON_KINDS.filter(installsFromManifest);

/**
 * @description Lists every installed addon the updater checks, re-listing when one is installed,
 * updated or removed, or its updates are paused or resumed.
 * @returns The addons, sorted by name; the same array until one of those changes.
 */
function useInstalledAddons(): InstalledEntry[] {
	const [revision, bump] = useReducer((n: number) => n + 1, 0);

	useEffect(() => {
		const offs = KINDS.flatMap((kind) => [
			Manager.for(kind).onInstalledChange(bump),
			onRecordChange(kind, ['held'], bump),
		]);

		return () => {
			for (const off of offs) off();
		};
	}, []);

	// Listed once per change, not per render: the page re-renders on every store update while it loads.
	return useMemo(
		() =>
			KINDS.flatMap((kind) => Manager.for(kind).listInstalled()).sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		[revision],
	);
}

export default useInstalledAddons;
