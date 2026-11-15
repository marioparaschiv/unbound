import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

import { messageTextSize, type MessageTextSize } from '~/native/text-size';
import { scaleOf } from '~/lib/text-size';

let session: MessageTextSize | undefined;
let stopWatching: (() => void) | undefined;

export function start(context: PluginContext) {
	session = messageTextSize(context.native, scaleOf(settings.scale));
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => session?.update(scaleOf(settings.scale)),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	session?.dispose();
	session = undefined;
}
