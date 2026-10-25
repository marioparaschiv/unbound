import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { PluginContext } from '@unbound-app/api/native';

import { createAndroidFileSizes } from '~/android/file-sizes';
import { patchMediaKeyboardItem } from '~/patches/media-keyboard-item';
import { PLUGIN_NAME } from '~/constants';
import type { FileSizeLookup } from '~/badges';

let dispose = () => {};

function androidLookup(context: PluginContext): { lookup?: FileSizeLookup; dispose: () => void } {
	if (
		context.platform !== 'android' ||
		!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)
	) {
		return { dispose: () => {} };
	}

	return createAndroidFileSizes(context.native.java);
}

function start(context: PluginContext) {
	const sizes = androidLookup(context);

	dispose = applyFeatures(PLUGIN_NAME, [
		() => sizes.dispose,
		() => patchMediaKeyboardItem(sizes.lookup),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
