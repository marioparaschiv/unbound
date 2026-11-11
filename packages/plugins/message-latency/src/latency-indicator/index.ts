import type { Feature } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMessageRowData } from '~/latency-indicator/message-row-data';
import { subscribeMessageCreate } from '~/latency-indicator/message-create';
import { createLatencyRecords } from '~/latency-indicator/records';
import { createIndicators } from '~/latency-indicator/platform';
import { Theme, UserStore } from '~/latency-indicator/modules';

/**
 * @description Marks messages that took a long time to send with an indicator beside their author.
 * Patches `generateMessageRowData` on Discord's message row module to measure each row, reads `UserStore`
 * and `Theme`, and draws the indicator through native views. Ending the features removes the indicators, the Flux
 * listener and the patch, and the native views and the runtime subscription, which the Addon scope cannot see.
 * @param context The plugin's native bridge and capabilities.
 * @returns The features, which depend on each other, or nothing when a module or the indicators are missing.
 */
export function latencyFeatures(context: PluginContext): Feature[] | undefined {
	if (!ensureModules({ UserStore, Theme })) return;

	const records = createLatencyRecords();
	const indicators = createIndicators(context, records);

	if (!indicators) return;

	return [
		() => patchMessageRowData(records),
		indicators,
		() => subscribeMessageCreate(records, context.native.runtime),
	];
}
