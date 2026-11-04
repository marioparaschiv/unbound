import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { patchMessageRowData } from '~/latency-indicator/message-row-data';
import { subscribeMessageCreate } from '~/latency-indicator/message-create';
import { createLatencyRecords } from '~/latency-indicator/records';
import { createIndicators } from '~/latency-indicator/platform';
import { Theme, UserStore } from '~/latency-indicator/modules';

let dispose: () => Promise<void> | undefined = () => undefined;

/**
 * @description Marks messages that took a long time to send with an indicator beside their author.
 * Patches `generateMessageRowData` on Discord's message row module to measure each row, reads `UserStore`
 * and `Theme`, and draws the indicator through native views. The Addon scope removes the patch and the
 * Flux listener, but the native views and the runtime subscription need `stopLatencyIndicator`.
 * @param context The plugin's native bridge and capabilities.
 */
export function startLatencyIndicator(context: PluginContext): void {
	if (!ensureModules('Message Latency', { UserStore, Theme })) return;

	const records = createLatencyRecords();
	const indicators = createIndicators(context, records);

	if (!indicators) return;

	patchMessageRowData(records);

	dispose = applyFeatures('Message Latency', [
		indicators,
		() => subscribeMessageCreate(records, context.native.runtime),
	]);
}

/**
 * @description Removes every indicator and the runtime subscription.
 * @returns A promise that settles once the native views are gone.
 */
export async function stopLatencyIndicator(): Promise<void> {
	const finished = dispose();

	dispose = () => undefined;
	await finished;
}
