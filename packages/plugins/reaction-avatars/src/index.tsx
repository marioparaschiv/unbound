import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { hookReactions, unhookReactions } from '~/native/hooks';

export function start(context: PluginContext) {
	hookReactions(context);
}

export function stop() {
	patcher.unpatchAll();
	unhookReactions();
}
