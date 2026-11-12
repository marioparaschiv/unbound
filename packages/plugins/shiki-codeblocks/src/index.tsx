import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { checkCodeCards, drawCodeCards, stopCodeCards } from '~/native/cards';

export function start(context: PluginContext) {
	drawCodeCards(context);
}

// The native hooks are outside the Addon scope, so their cleanup must finish before it closes.
export async function stop() {
	patcher.unpatchAll();
	await stopCodeCards();
}

export function selfTest() {
	return checkCodeCards();
}

export { SettingsPanel } from '~/settings';
