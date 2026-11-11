import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { closeWindow, openWindow } from '~/native/window';
import { patchOverlayHeader } from '~/patches/overlay-header';

export function start(context: PluginContext) {
	openWindow(context);
	patchOverlayHeader();
}

export function stop() {
	patcher.unpatchAll();
	closeWindow();
}
