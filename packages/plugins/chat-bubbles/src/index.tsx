import type { PluginContext } from '@unbound-app/api/native';

import { bubblesSelfTest, startBubbles, stopBubbles } from '~/bubbles';
import SettingsPanel from '~/settings';

export function start(context: PluginContext) {
	startBubbles(context);
}

export function stop() {
	return stopBubbles();
}

export { bubblesSelfTest as selfTest, SettingsPanel };
