import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createIndicators as android } from '~/native/indicators-android';
import { createIndicators as ios } from '~/native/indicators-ios';
import { createLatencyRecords, type LatencyRecords } from '~/lib/records';
import { Theme } from '~/lib/modules';

/** The drawn indicators; `dispose` removes them, which the Addon scope cannot do for native views. */
export type Indicators = {
	dispose(): Promise<void>;
};

const createPlatformIndicators = native.definePlatform({ ios, android });

let drawn: { indicators: Indicators; records: LatencyRecords } | null = null;

/**
 * @description Marks messages that took a long time to send with an indicator beside their author, drawn through native views.
 * Reads `UserStore` and `Theme`; warns and draws nothing when Discord moved `Theme` or the platform lacks what it draws with.
 * @param context The plugin's native bridge and capabilities.
 */
export function drawIndicators(context: PluginContext): void {
	drawn = null;

	if (!Theme) {
		logger.warn('Latency indicator skipped: Discord moved Theme.');

		return;
	}

	const records = createLatencyRecords();
	const indicators = createPlatformIndicators(context, records);

	if (indicators) drawn = { indicators, records };
}

/**
 * @description Reads the latency cache the indicators draw from, which the measuring features fill.
 * @returns The cache, or `undefined` when no indicators are drawn.
 */
export function drawnRecords(): LatencyRecords | undefined {
	return drawn?.records;
}

/**
 * @description Removes every indicator.
 * @returns A promise that settles once the native views are restored.
 */
export async function removeIndicators(): Promise<void> {
	const current = drawn;

	drawn = null;

	await current?.indicators.dispose();
}
