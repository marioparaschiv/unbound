import { patcher } from '@unbound-app/api';

import { forgetSearches } from '~/lib/search';
import { patchProfile } from '~/patches/profile';

export function start() {
	patchProfile();
}

export function stop() {
	patcher.unpatchAll();
	forgetSearches();
}
