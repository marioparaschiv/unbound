import { useMemo } from 'react';

import useAddons from '~/ui/hooks/use-addons';
import type { Addon } from '~/addons/addon';

/**
 * @description A kind's installed addons as a list that keeps its identity until an addon is added or removed, so the
 * picker's swatches and the patches keyed on them are rebuilt only then. It still re-renders on every manager event.
 * @param kind The manager kind to read.
 * @returns The installed addons.
 */
function useStableAddons(kind: 'theme' | 'icon-pack'): Addon[] {
	const installed = useAddons(kind);
	// The manager hands back a fresh array each render; the ids say when the list really changed.
	const ids = installed.map((addon) => addon.id).join();

	return useMemo(() => installed, [ids]);
}

export default useStableAddons;
