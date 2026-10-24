import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMessageRowData } from '~/patches/message-row-data';
import { subscribeMessageCreate } from '~/events/message-create';
import { createMessageCells } from '~/native/message-cells';
import SettingsPanel from '~/components/settings-panel';
import { createTooltips } from '~/native/tooltip';
import { createLatencyRecords } from '~/records';
import { Theme, UserStore } from '~/modules';

let dispose = () => {};
let settled = () => Promise.resolve();

function start(context: PluginContext) {
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

function stop() {
	dispose();
	dispose = () => {};

	return settled();
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
