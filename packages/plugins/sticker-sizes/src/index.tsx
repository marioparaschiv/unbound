import type { PluginContext } from '@unbound-app/api/native';
import { storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { parseScale } from '~/lib/scale';
import { stickerScale } from '~/native/scale';

let scaled: ReturnType<typeof stickerScale> | undefined;
let stopWatching: (() => void) | undefined;

export function start(context: PluginContext) {
	scaled = stickerScale(context.native, () => parseScale(settings.scale));
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => scaled?.refresh(),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	scaled?.dispose();
	scaled = undefined;
}
