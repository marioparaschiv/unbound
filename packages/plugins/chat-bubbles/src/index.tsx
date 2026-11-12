import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { bubblesSelfTest, drawBubbles, listenToAppearance, removeBubbles } from '~/native/views';
import SettingsPanel from '~/settings';

export function start(context: PluginContext) {
	drawBubbles(context);
	listenToAppearance();
}

export async function stop() {
	patcher.unpatchAll();
	await removeBubbles();
}

export function selfTest() {
	return bubblesSelfTest();
}

export { SettingsPanel };
