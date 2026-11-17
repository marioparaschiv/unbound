import type { PluginContext } from '@unbound-app/api/native';

import { KEY_ACTIONS } from '~/lib/keys';
import { perform } from '~/lib/actions';
import { listenToController } from '~/native/controller';

let stopListening: (() => void) | undefined;

export function start(context: PluginContext) {
	stopListening = listenToController(context.native, (code) => {
		const action = KEY_ACTIONS[code];

		if (action) perform(action);
	});
}

export function stop() {
	stopListening?.();
	stopListening = undefined;
}
