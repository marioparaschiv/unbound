import { storage } from '@unbound-app/api';

import { startSlideshow, stopSlideshow } from '~/lib/background';

let stopWatching: (() => void) | undefined;

export function start() {
	startSlideshow();
	stopWatching = storage.onChange(
		({ store, key }) => store === addon.id && (key === 'wallpapers' || key === 'interval'),
		() => startSlideshow(),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	stopSlideshow();
}
