import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { PluginContext } from '@unbound-app/api/native';

import { createMessageCells } from '~/latency-indicator/ios/message-cells';
import { installReuseGuard } from '~/latency-indicator/ios/reuse-guard';
import type { LatencyRecords } from '~/latency-indicator/records';
import { createTooltips } from '~/latency-indicator/ios/tooltip';

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
	const { objc, ui } = context.native;

	if (
		!ensureClasses(objc, ['DCDMessageTableViewCell', 'NSLayoutConstraint', 'UIColor', 'UIFont'])
	) {
		return null;
	}

	const cells = createMessageCells(objc, records, createTooltips(context.native));

	return () => {
		const scope = ui.createScope();

		ui.run(installReuseGuard, scope);

		const unhook = cells.hook();

		return () => {
			scope.dispose();

			return unhook();
		};
	};
}

export default { createIndicators };
