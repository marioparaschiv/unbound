import type { ImageURISource } from 'react-native';
import { useEffect, useState } from 'react';

import type { Addon } from '~/addons/addon';

import { loadSamples } from './icon-pack-samples';

/** The samples last read, with the pack they belong to. */
type Loaded = { pack: Addon; samples: ImageURISource[] };

/**
 * @description Reads the sample icons an icon pack draws, for its swatch, or another set of them, such as all of them.
 * @param pack The icon pack.
 * @param load Reads the icons; a stable function, the samples by default.
 * @returns Its icons, or an empty list until they are read.
 */
function usePackSamples(
	pack: Addon,
	load: (pack: Addon) => Promise<ImageURISource[]> = loadSamples,
): ImageURISource[] {
	const [loaded, setLoaded] = useState<Loaded>();

	useEffect(() => {
		let current = true;

		void load(pack).then((samples) => {
			if (current) {
				setLoaded({ pack, samples });
			}
		});

		return () => {
			current = false;
		};
	}, [pack, load]);

	// A carousel scrolled onto another pack shows nothing rather than the last pack's icons.
	return loaded?.pack === pack ? loaded.samples : [];
}

export default usePackSamples;
