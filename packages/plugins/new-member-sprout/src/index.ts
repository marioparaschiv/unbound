import type { PluginContext } from '@unbound-app/api/native';

import { createSproutTooltip, type SproutTooltip } from '~/native/tooltip';
import { patchMessageRows, patchSproutTaps } from '~/patches';

let tooltip: SproutTooltip | undefined;

export function start(context: PluginContext) {
	patchMessageRows();
	tooltip = createSproutTooltip(context);

	if (tooltip) patchSproutTaps(tooltip);
}

export async function stop() {
	await tooltip?.dispose();
	tooltip = undefined;
}
