import type { PluginContext } from '@unbound-app/api/native';
import { chatRowsSelfTest, trackChatRows } from '@unbound-plugins/shared/lifecycle/chat-rows';
import { patcher } from '@unbound-app/api';

import { bubblesSelfTest, drawBubbles, listenToAppearance, removeBubbles } from '~/native/views';
import SettingsPanel from '~/settings';

export function start(context: PluginContext) {
	drawBubbles(context);
	listenToAppearance();
	trackChatRows();
}

export async function stop() {
	patcher.unpatchAll();
	await removeBubbles();
}

export async function selfTest() {
	const rows = chatRowsSelfTest();

	return rows.ok ? bubblesSelfTest() : rows;
}

export { SettingsPanel };
