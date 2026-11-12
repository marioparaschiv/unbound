import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import { createAndroidIndicators } from '~/native/android/views';
import { createAndroidTooltips } from '~/native/android/tooltip';
import type { LatencyRecords } from '~/lib/records';
import type { Indicators } from '~/native/indicators';

/**
 * @description Draws the indicator in Discord's Android message rows.
 * @param context The plugin context, whose native bridge draws the indicator.
 * @param records The latency cache to draw from.
 * @returns The indicators, or `null` after a warning when a capability or the icon surface is missing.
 */
export function createIndicators(
	context: PluginContext,
	records: LatencyRecords,
): Indicators | null {
	if (!ensureCapabilities(context.native, context.capabilities)) return null;

	const indicators = createAndroidIndicators(
		context.native,
		records,
		createAndroidTooltips(context.native),
	);

	if (!indicators) {
		logger.warn('Plugin skipped: the indicator surface did not register.');

		return null;
	}

	return indicators;
}

export default { createIndicators };
