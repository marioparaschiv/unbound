import type { PluginContext } from '@unbound-app/api/native';

import { selfTestEmbeds, startMessageLinkEmbeds } from '~/embeds';
import type { Embeds } from '~/embeds/modules';

let embeds: Embeds | undefined;

export function start(context: PluginContext) {
	embeds = startMessageLinkEmbeds(context);
}

export function stop() {
	const finished = embeds?.dispose();

	embeds = undefined;

	return finished;
}

export function selfTest() {
	return selfTestEmbeds(embeds);
}
