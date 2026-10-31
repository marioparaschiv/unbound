import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { drawnSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	MessageStore,
	RoleStore,
	RowGenerator,
	SelectedChannelStore,
	settings,
	UserStore,
} from '~/modules';
import { createMentionIndex } from '~/mention-index';
import { startMentions } from '~/platform';

let renderer: ReturnType<typeof startMentions> | undefined;

function start(context: PluginContext) {
	const modules = {
		MessageStore,
		SelectedChannelStore,
		UserStore,
		generateMessageRowData: RowGenerator.generateMessageRowData,
	};

	if (
		!ensureCapabilities('Mention Avatars', context.native, context.capabilities) ||
		!ensureModules('Mention Avatars', modules)
	) {
		return;
	}

	const index = createMentionIndex(
		ensureModules('Mention Avatars: role mentions', { RoleStore }),
	);

	renderer = startMentions(context.native, index, () => settings.get('showAtSymbol', true));
}

function stop() {
	void renderer?.dispose();
	renderer = undefined;
}

function selfTest() {
	const missing = renderer?.failed() ?? [];

	if (missing.length) {
		return { ok: false, detail: `${missing.length} mention avatars failed to load` };
	}

	return drawnSelfTest(renderer?.rendered, 'mention avatars', renderer?.settling);
}

export default {
	start,
	stop,
	selfTest,
};
