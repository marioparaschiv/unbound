import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { PluginContext } from '@unbound-app/api/native';

import { createMessageCells } from '~/native/views-ios';
import { installReuseGuard } from '~/native/worklets-ios';
import type { LatencyRecords } from '~/lib/records';
import { createTooltips } from '~/native/tooltip-ios';
import type { Indicators } from '~/native/indicators';

/**
 * @description Hooks Discord's iOS message cells to draw the indicator.
 * @param context The plugin context, whose native bridge draws the indicator.
 * @param records The latency cache to draw from.
 * @returns The indicators, or `null` after a warning when a native class it needs is missing.
 */
export function createIndicators(
	context: PluginContext,
	records: LatencyRecords,
): Indicators | null {
	const { objc, ui } = context.native;

	if (
		!ensureClasses(objc, ['DCDMessageTableViewCell', 'NSLayoutConstraint', 'UIColor', 'UIFont'])
	) {
		return null;
	}

	const cells = createMessageCells(objc, records, createTooltips(context.native));
	const scope = ui.createScope();

	ui.run(installReuseGuard, scope);

	const unhook = cells.hook();

	return {
		dispose() {
			scope.dispose();

			return unhook();
		},
	};
}

export default { createIndicators };
