import { patcher } from '@unbound-app/api';

import { loadBanners } from '~/lib/banners';
import { patchBannerUrls } from '~/patches';

export function start() {
	void loadBanners();
	patchBannerUrls();
}

export function stop() {
	patcher.unpatchAll();
}
