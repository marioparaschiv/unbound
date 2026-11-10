import type { ImageURISource } from 'react-native';
import { useEffect, useState } from 'react';

import type { Addon } from '~/addons/addon';

import { loadSamples } from './icon-pack-samples';

/** The samples last read, with the pack they belong to. */
type Loaded = { pack: Addon; samples: ImageURISource[] };

/**
 * @description Reads the sample icons an icon pack draws, for its swatch and preview.
 * @param pack The icon pack.
 * @returns Its samples, or an empty list until they are read.
 */
function usePackSamples(pack: Addon): ImageURISource[] {
	const [loaded, setLoaded] = useState<Loaded>();

	useEffect(() => {
		let current = true;

		void loadSamples(pack).then((samples) => {
			if (current) {
				setLoaded({ pack, samples });
			}
		});

		return () => {
			current = false;
		};
	}, [pack]);

	// A carousel scrolled onto another pack shows nothing rather than the last pack's icons.
	return loaded?.pack === pack ? loaded.samples : [];
}

export default usePackSamples;
