import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

import { greentext, type GreentextSession } from '~/native/greentext';
import { colorOf } from '~/lib/greentext';
import SettingsPanel from '~/settings';

let session: GreentextSession | undefined;
let stopWatching: (() => void) | undefined;

export function start(context: PluginContext) {
	session = greentext(context.native, colorOf(settings.color));
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => session?.update(colorOf(settings.color)),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	session?.dispose();
	session = undefined;
}

export { SettingsPanel };
