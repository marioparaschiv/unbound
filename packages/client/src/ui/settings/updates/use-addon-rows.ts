import { useMemo, useState } from 'react';

import type { InstalledEntry, PendingUpdate } from '~/updates/addon-updates';

/** One installed addon as the Addons list draws it. */
export type AddonRowItem = {
	entry: InstalledEntry;
	/** Its pending update, if the last check found one. */
	update: PendingUpdate | undefined;
	/** Whether the Marketplace lists it; an unlisted addon never updates. */
	listed: boolean;
};

/**
 * @description Orders the installed addons for the Addons list, listed ones first, and tracks whether the list is
 * open: it opens while an update waits, until the header is first pressed.
 * @param addons The installed addons, sorted by name.
 * @param updates The pending addon updates.
 * @param listed The ids the Marketplace lists; `undefined` until a catalog is available.
 * @returns The rows to show (none while closed), every addon's count, whether the list is open, and its toggle.
 */
function useAddonRows(
	addons: InstalledEntry[],
	updates: PendingUpdate[],
	listed: Set<string> | undefined,
) {
	const [toggled, setToggled] = useState<boolean | undefined>(undefined);
	const expanded = toggled ?? updates.length > 0;

	const items = useMemo(() => {
		const pending = new Map(updates.map((update) => [update.id, update]));
		const rows = addons.map((entry) => ({
			entry,
			update: pending.get(entry.id),
			listed: !listed || listed.has(entry.id),
		}));

		// Stable sort keeps the name order within the listed and unlisted runs.
		return rows.sort((a, b) => Number(b.listed) - Number(a.listed));
	}, [addons, updates, listed]);

	return {
		rows: expanded ? items : [],
		expanded,
		toggle: () => setToggled(!expanded),
	};
}

export default useAddonRows;
