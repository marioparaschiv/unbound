import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { PluginContext } from '@unbound-app/api/native';

import { createMessageCells } from '~/ios/message-cells';
import type { LatencyRecords } from '~/records';
import { createTooltips } from '~/ios/tooltip';

/**
 * @description Prepares the indicator for Discord's iOS message cells.
 * @param context The plugin context, whose native bridge draws the indicator.
 * @param records The latency cache to draw from.
 * @returns The feature that hooks the cells, or `null` when a native class it needs is missing.
 */
export function createIndicators(
	context: PluginContext,
	records: LatencyRecords,
): (() => () => Promise<void>) | null {
	const { objc, fabric } = context.native;

	if (
		!ensureClasses('Message Latency', objc, [
			'DCDMessageTableViewCell',
			'NSLayoutConstraint',
			'UIColor',
			'UIFont',
		])
	) {
		return null;
	}

	const cells = createMessageCells(objc, records, createTooltips(objc, fabric));

	return () => cells.hook();
}

export default { createIndicators };
