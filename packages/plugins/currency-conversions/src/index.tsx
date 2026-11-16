import { patcher } from '@unbound-app/api';

import { patchMessageRows } from '~/patches';
import { refreshRates } from '~/lib/rates';

export function start() {
	void refreshRates();
	patchMessageRows();
}

export function stop() {
	patcher.unpatchAll();
}
