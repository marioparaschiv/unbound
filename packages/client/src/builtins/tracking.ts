import noop from '@unbound-app/utils/noop';

import { onModuleLoaded } from '~/metro/wait';
import { createPatcher } from '~/patcher/api';
import { findByProps } from '~/metro/search';
import { byProps } from '~/metro/filters';

const Patcher = createPatcher('unbound::tracking');

const Metadata = findByProps('trackWithMetadata', { lazy: true });
const Properties = findByProps('track', 'encodeProperties', { lazy: true });

let stopWaiting: (() => void) | null = null;

/** Disables Discord's analytics trackers as Discord loads them. */
export function start() {
	Patcher.instead(Metadata, 'trackWithMetadata', noop);
	Patcher.instead(Properties, 'track', noop);

	stopWaiting = onModuleLoaded(byProps('AnalyticsActionHandlers'), (Handlers) => {
		const { AnalyticsActionHandlers } = Handlers;

		Patcher.instead(AnalyticsActionHandlers, 'handleConnectionClosed', noop);
		Patcher.instead(AnalyticsActionHandlers, 'handleConnectionOpen', noop);
		Patcher.instead(AnalyticsActionHandlers, 'handleFingerprint', noop);
		Patcher.instead(AnalyticsActionHandlers, 'handleTrack', noop);
	});
}

/** Restores Discord's analytics trackers. */
export function stop() {
	stopWaiting?.();
	stopWaiting = null;
	Patcher.unpatchAll();
}

export default { start, stop };
