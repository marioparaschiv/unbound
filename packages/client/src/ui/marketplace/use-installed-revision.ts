import type { AddonKind } from '@unbound-app/types/addons';
import { useEffect, useState } from 'react';

import { Manager } from '~/addons/manager';

/**
 * @description Counts the installs and removals of one kind since mount, so a list filtered by what is installed redraws.
 * @param kind The manager to watch.
 * @returns A number that changes whenever the kind's installed addons do.
 */
function useInstalledRevision(kind: AddonKind): number {
	const [revision, setRevision] = useState(0);

	useEffect(
		() => Manager.for(kind).onInstalledChange(() => setRevision((count) => count + 1)),
		[kind],
	);

	return revision;
}

export default useInstalledRevision;
