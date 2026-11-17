import type { PluginContext } from '@unbound-app/api/native';
import { storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { emojiPacks } from '~/native/packs';

let packs: ReturnType<typeof emojiPacks> | undefined;
let stopWatching: (() => void) | undefined;

export function start(context: PluginContext) {
	packs = emojiPacks(context.native, () => settings.pack);
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => packs?.refresh(),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	packs?.dispose();
	packs = undefined;
}
