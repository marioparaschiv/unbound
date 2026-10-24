import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { MessageRowData, MessageStore, UserProfileStore, UserStore } from '~/modules';
import { patchMessageRowData } from '~/patches/message-row-data';
import SettingsPanel from '~/components/settings-panel';
import { createLookup } from '~/lookup';

let dispose = () => {};

function start() {
	if (!ensureModules('PronounDB', { MessageRowData, UserProfileStore, UserStore })) return;

	// Without the message store, fetched pronouns show on the next re-render instead of at once.
	const lookup = createLookup(() => MessageStore.emitChange?.());

	dispose = applyFeatures('PronounDB', [() => lookup.dispose, () => patchMessageRowData(lookup)]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
