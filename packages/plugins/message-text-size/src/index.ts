import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { plugins, storage } from '@unbound-app/api';

import { messageTextSize, type MessageTextSize } from '~/native/text-size';
import { scaleOf } from '~/lib/text-size';

const SETTLED_REDRAW_MS = 3000;

let session: MessageTextSize | undefined;
let stopWatching: (() => void) | undefined;
let settledRedraw: ReturnType<typeof setTimeout> | undefined;

export function start(context: PluginContext) {
	session = messageTextSize(context.native, scaleOf(settings.scale));
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => {
			session?.update(scaleOf(settings.scale));
			plugins.redrawChat?.();
		},
	);
	settledRedraw = setTimeout(() => plugins.redrawChat?.(), SETTLED_REDRAW_MS);
}

export function stop() {
	clearTimeout(settledRedraw);
	settledRedraw = undefined;
	stopWatching?.();
	stopWatching = undefined;
	session?.dispose();
	session = undefined;
}
