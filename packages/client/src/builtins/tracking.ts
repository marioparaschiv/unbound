import type { FluxAction } from '@unbound-app/types/flux';
import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';

import { createPatcher } from '~/patcher/create-patcher';
import { byFilePath, byProps } from '~/metro/filters';
import { findByProps } from '~/metro/lookups';
import { onModuleLoaded } from '~/metro/wait';
import { interceptAction } from '~/flux/api';

const Patcher = createPatcher('unbound::tracking');
const Logger = createLogger('BuiltIns', 'Tracking');

const Metadata = findByProps('trackWithMetadata', { lazy: true });
const Properties = findByProps('track', 'encodeProperties', { lazy: true });

/** Discord's managers that only collect analytics: session heartbeats, touches, speaking, jank, MetricKit and telemetry. */
export const ANALYTICS_MANAGERS = [
	'modules/analytics_sessions/SessionAdManager.tsx',
	'modules/touch_analytics/TouchEventAnalyticsManager.tsx',
	'modules/touch_analytics/TouchEventAnalyticsManager.android.tsx',
	'modules/app_analytics/AppAnalyticsManager.tsx',
	'modules/jank_stats/native/JankSessionManager.ios.tsx',
	'modules/jank_stats/native/JankSessionManager.android.tsx',
	'modules/jank_stats/native/JankStatsManager.ios.tsx',
	'modules/jank_stats/native/JankStatsManager.android.tsx',
	'modules/metric_kit_tracker/native/MetricKitManager.ios.tsx',
	'modules/metric_kit_tracker/native/MetricKitManager.android.tsx',
	'modules/sentry/SentryExperimentFeatureFlagManager.tsx',
	'modules/telemetry_ring/native/TelemetryRingLifecycle.tsx',
];

/** Discord's lifecycle manager: `initialize` subscribes it, `terminate` unsubscribes it. */
type LifecycleManager = {
	initialize: () => void;
	terminate: () => void;
	isInitialized?: boolean;
	initializedCount?: number;
};

/** A `TRACK` action; `resolve` settles the promise the caller of `track` awaits. */
type TrackAction = FluxAction<'TRACK'> & {
	resolve?: () => void;
};

// `track` returns a promise its callers may chain on.
const resolved = () => Promise.resolve();

let stopWaiting: (() => void)[] = [];

function isLifecycleManager(value: MetroExport): value is LifecycleManager {
	return typeof value?.initialize === 'function' && typeof value.terminate === 'function';
}

// Keeps the manager from subscribing; one Discord already started is stopped.
function disableManager(path: string, mdl: MetroExport) {
	const manager = mdl?.default ?? mdl;

	if (!isLifecycleManager(manager)) {
		Logger.warn(`Failed to find the analytics manager in ${path}.`);

		return;
	}

	Patcher.instead(manager, 'initialize', noop);

	if (!manager.isInitialized && !manager.initializedCount) return;

	try {
		manager.terminate();
	} catch (error) {
		Logger.error(`Failed to stop the analytics manager ${path}:`, error);
	}
}

// Settles the caller's promise, then drops the action so no store queues the event.
function dropTrack(action: TrackAction) {
	action.resolve?.();

	return true;
}

/** Disables Discord's analytics: its trackers, its `TRACK` actions and the managers that collect them. */
export function start() {
	if (Metadata) {
		Patcher.instead(Metadata, 'trackWithMetadata', resolved);
	}

	if (Properties) {
		Patcher.instead(Properties, 'track', resolved);
	}

	stopWaiting = [
		interceptAction('TRACK', dropTrack),
		onModuleLoaded(byProps('AnalyticsActionHandlers'), (Handlers) => {
			const { AnalyticsActionHandlers } = Handlers;

			Patcher.instead(AnalyticsActionHandlers, 'handleConnectionClosed', noop);
			Patcher.instead(AnalyticsActionHandlers, 'handleConnectionOpen', noop);
			Patcher.instead(AnalyticsActionHandlers, 'handleFingerprint', noop);
			Patcher.instead(AnalyticsActionHandlers, 'handleTrack', noop);
		}),
		...ANALYTICS_MANAGERS.map((path) =>
			onModuleLoaded(byFilePath(path), (mdl) => disableManager(path, mdl)),
		),
	];
}

/** Restores Discord's analytics. Managers it stopped start again on Discord's next launch. */
export function stop() {
	for (const stopOne of stopWaiting) stopOne();

	stopWaiting = [];
	Patcher.unpatchAll();
}

export default { start, stop };
