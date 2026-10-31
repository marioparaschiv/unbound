import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMessageRowData } from '~/patches/message-row-data';
import { subscribeMessageCreate } from '~/events/message-create';
import SettingsPanel from '~/components/settings-panel';
import { createLatencyRecords } from '~/records';
import { createIndicators } from '~/platform';
import { Theme, UserStore } from '~/modules';

let dispose: () => Promise<void> | undefined = () => undefined;

function start(context: PluginContext) {
	if (!ensureModules('Message Latency', { UserStore, Theme })) return;

	const records = createLatencyRecords();
	const indicators = createIndicators(context, records);

	if (!indicators) return;

	dispose = applyFeatures('Message Latency', [
		indicators,
		() => subscribeMessageCreate(records, context.native.runtime),
		() => patchMessageRowData(records),
	]);
}

async function stop() {
	const finished = dispose();

	dispose = () => undefined;
	await finished;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
