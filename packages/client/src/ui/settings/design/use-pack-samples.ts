import type { ImageURISource } from 'react-native';
import { useEffect, useState } from 'react';

import type { Addon } from '~/addons/addon';

import { loadSamples } from './icon-pack-samples';

/**
 * @description Reads the sample icons an icon pack draws, for its swatch, or another set of them, such as all of them.
 * @param pack The icon pack.
 * @param load Reads the icons; a stable function, the samples by default.
 * @returns Its icons, the previous pack's until they are read, or an empty list before the first read.
 */
function usePackSamples(
	pack: Addon,
	load: (pack: Addon) => Promise<ImageURISource[]> = loadSamples,
): ImageURISource[] {
	const [samples, setSamples] = useState<ImageURISource[]>([]);

	useEffect(() => {
		let current = true;

		void load(pack).then((read) => {
			if (current) {
				setSamples(read);
			}
		});

		return () => {
			current = false;
		};
	}, [pack, load]);

	// A carousel scrolled onto another pack keeps the last pack's icons until its own are read, so nothing blanks.
	return samples;
}

export default usePackSamples;
