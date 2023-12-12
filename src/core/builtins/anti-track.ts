import type { BuiltIn } from '@typings/core/builtins';
import { attempt, noop } from '@utilities';
import { createPatcher } from '@patcher';
import { findByProps } from '@metro';

const Patcher = createPatcher('no-track');

export const data: BuiltIn['data'] = {
	id: 'modules.antiTrack',
	default: true
};

export function initialize() {
	const Metadata = findByProps('trackWithMetadata', { lazy: true });
	const Analytics = findByProps('AnalyticsActionHandlers', { lazy: true });
	const Properties = findByProps('encodeProperties', 'track', { lazy: true });

	attempt(() => Patcher.instead(Metadata, 'trackWithMetadata', noop));

	attempt(() => Patcher.instead(Analytics.AnalyticsActionHandlers, 'handleConnectionClosed', noop));
	attempt(() => Patcher.instead(Analytics.AnalyticsActionHandlers, 'handleConnectionOpen', noop));
	attempt(() => Patcher.instead(Analytics.AnalyticsActionHandlers, 'handleFingerprint', noop));
	attempt(() => Patcher.instead(Analytics.AnalyticsActionHandlers, 'handleTrack', noop));

	attempt(() => Patcher.instead(Properties, 'track', noop));
}

export function shutdown() {
	Patcher.unpatchAll();
}
