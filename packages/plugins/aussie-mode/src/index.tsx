import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { native, storage } from '@unbound-app/api';

import { isAussieDevice } from '~/locale';
import { startRotation } from '~/rotation';

const settings = storage.getBucket();

let dispose = () => {};

function start() {
	if (!isAussieDevice()) return;

	if (!settings.get('reloadedSinceEnable', false)) {
		settings.set('reloadedSinceEnable', true);
		void native.reload();
		return;
	}

	dispose = applyFeatures('Aussie Mode', [startRotation]);
}

function stop() {
	dispose();
	dispose = () => {};

	const reloadedSinceEnable = settings.get('reloadedSinceEnable', false);

	settings.set('reloadedSinceEnable', false);

	if (reloadedSinceEnable) {
		void native.reload();
	}
}

export default { start, stop };
