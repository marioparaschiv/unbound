import { patcher } from '@unbound-app/api';

import { patchBioText } from '~/patches';

export function start() {
	patchBioText();
}

export function stop() {
	patcher.unpatchAll();
}
