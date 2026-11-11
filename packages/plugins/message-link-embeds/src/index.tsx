import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { drawEmbeds, eraseEmbeds, selfTestEmbeds } from '~/native/embeds';
import { patchFastImage, restoreLottieViews, swapLottieViews } from '~/patches';

export function start(context: PluginContext) {
	drawEmbeds(context);
	patchFastImage();
	swapLottieViews();
}

export async function stop() {
	patcher.unpatchAll();
	restoreLottieViews();
	await eraseEmbeds();
}

export function selfTest() {
	return selfTestEmbeds();
}
