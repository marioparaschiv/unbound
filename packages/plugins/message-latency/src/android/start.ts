import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import { createAndroidIndicators } from '~/android/indicators';
import { createAndroidTooltips } from '~/android/tooltip';
import type { LatencyRecords } from '~/records';

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
	if (!ensureCapabilities('Message Latency', context.native, context.capabilities)) return null;

	const indicators = createAndroidIndicators(
		context.native,
		records,
		createAndroidTooltips(context.native),
	);

	if (!indicators) {
		console.error('[Message Latency] Skipped, the indicator surface did not register.');

		return null;
	}

	return () => () => indicators.dispose();
}

export default { createIndicators };
