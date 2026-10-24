import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';

import { patchMediaKeyboardItem } from '~/patches/media-keyboard-item';

let dispose = () => {};

function start() {
	dispose = applyFeatures('File Size On Picker', [patchMediaKeyboardItem]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
