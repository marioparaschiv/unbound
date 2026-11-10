import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { isAussieDevice } from '~/locale';
import { startRotation } from '~/rotation';
import { startUpsideDownText } from '~/text';

// Off an Australian device the plugin starts nothing, and it has no self test the device matrix would fail.
export const { start, stop } = runFeatures(() => {
	if (!isAussieDevice()) return;

	return [
		startUpsideDownText,
		// `start` waits for the first rotation.
		(context) =>
			startRotation(context.native, (error) =>
				logger.error('Failed to rotate the screen:', error),
			),
	];
});
