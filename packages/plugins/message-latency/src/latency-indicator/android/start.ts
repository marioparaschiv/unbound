import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import type { PluginContext } from '@unbound-app/api/native';

import { createAndroidIndicators } from '~/latency-indicator/android/indicators';
import { createAndroidTooltips } from '~/latency-indicator/android/tooltip';
import type { LatencyRecords } from '~/latency-indicator/records';

/**
 * @description Draws the indicator in Discord's Android message rows.
 * @param context The plugin context, whose native bridge draws the indicator.
 * @param records The latency cache to draw from.
 * @returns The feature whose cleanup removes every indicator, or `null` when a capability or the icon surface is missing.
 */
export function createIndicators(
	context: PluginContext,
	records: LatencyRecords,
): (() => () => Promise<void>) | null {
	if (!ensureCapabilities(context.native, context.capabilities)) return null;

	const indicators = createAndroidIndicators(
		context.native,
		records,
		createAndroidTooltips(context.native),
	);

	if (!indicators) {
		skipFeature('the indicator surface did not register');

		return null;
	}

	return () => () => indicators.dispose();
}

export default { createIndicators };
