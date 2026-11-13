import { patcher } from '@unbound-app/api';

import { patchProfile } from '~/patches/profile';

export function start() {
	patchProfile();
}

export function stop() {
	patcher.unpatchAll();
}
