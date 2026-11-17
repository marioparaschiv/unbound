import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

import { fontFallback, type FontFallbackSession } from '~/native/font-fallback';
import { parseChoices } from '~/lib/choices';
import SettingsPanel from '~/settings';

let session: FontFallbackSession | undefined;
let stopWatching: (() => void) | undefined;

export function start(context: PluginContext) {
	session = fontFallback(context.native, parseChoices(settings.choices));
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => void session?.update(parseChoices(settings.choices)),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	session?.dispose();
	session = undefined;
}

export { SettingsPanel };
