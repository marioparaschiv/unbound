import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { drawnSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	ChannelStore,
	findRenderers,
	MessageActions,
	MessageStore,
	SelectedChannelStore,
	type Embeds,
	type Renderers,
} from '~/modules';
import { emptyEmbeds } from '~/components/message-surface';
import { startEmbeds } from '~/platform';

let embeds: Embeds | undefined;

function start(context: PluginContext) {
	const renderers = findRenderers();
	const modules = {
		ChannelStore,
		MessageStore,
		SelectedChannelStore,
		fetchMessage: MessageActions.fetchMessage,
		...renderers,
	};

	if (
		!ensureCapabilities('Message Link Embeds', context.native, context.capabilities) ||
		!ensureModules('Message Link Embeds', modules)
	) {
		return;
	}

	// `ensureModules` found every renderer.
	embeds = startEmbeds(context.native, renderers as Renderers);
}

function stop() {
	const finished = embeds?.dispose();

	embeds = undefined;

	return finished;
}

function selfTest() {
	const empty = emptyEmbeds();

	if (empty.length) return { ok: false, detail: `${empty.length} embeds stayed empty` };

	return drawnSelfTest(embeds?.drawn, 'embeds');
}

export default { start, stop, selfTest };
