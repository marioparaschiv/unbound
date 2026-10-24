import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMessageRowData } from '~/patches/message-row-data';
import { subscribeMessageCreate } from '~/events/message-create';
import { createAndroidIndicators } from '~/android/indicators';
import { createMessageCells } from '~/native/message-cells';
import { createAndroidTooltips } from '~/android/tooltip';
import SettingsPanel from '~/components/settings-panel';
import { createTooltips } from '~/native/tooltip';
import { createLatencyRecords } from '~/records';
import { Theme, UserStore } from '~/modules';

let dispose: () => Promise<void> | undefined = () => undefined;
let settled = () => Promise.resolve();

function startAndroid(context: PluginContext) {
	if (
		!ensureCapabilities('Message Latency', context.native, context.capabilities) ||
		!ensureModules('Message Latency', { UserStore, Theme })
	) {
		return;
	}

	const records = createLatencyRecords();
	const indicators = createAndroidIndicators(
		context.native,
		records,
		createAndroidTooltips(context.native),
	);

	if (!indicators) {
		console.error('[Message Latency] Skipped, the indicator surface did not register.');

		return;
	}

	dispose = applyFeatures('Message Latency', [
		() => records.clear,
		() => indicators.dispose,
		() => subscribeMessageCreate(records, context),
		() => patchMessageRowData(records),
	]);
}

function start(context: PluginContext) {
	if (context.platform === 'android') {
		startAndroid(context);

		return;
	}

	const { objc, fabric } = context.native;

	if (
		!ensureModules('Message Latency', { UserStore, Theme }) ||
		!ensureClasses('Message Latency', objc, [
			'DCDMessageTableViewCell',
			'NSLayoutConstraint',
			'UIColor',
			'UIFont',
		])
	) {
		return;
	}

	const records = createLatencyRecords();
	const cells = createMessageCells(objc, records, createTooltips(objc, fabric));

	settled = cells.settled;
	dispose = applyFeatures('Message Latency', [
		() => records.clear,
		() => cells.hook(),
		() => subscribeMessageCreate(records, context),
		() => patchMessageRowData(records),
	]);
}

async function stop() {
	const finished = dispose();

	dispose = () => undefined;
	await finished;
	await settled();
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
