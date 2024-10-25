import type { BuiltInData } from '@typings/built-ins';
import { createLogger } from '@structures/logger';
import { createPatcher } from '@api/patcher';
import { findByProps } from '@api/metro';
import { noop } from '@utilities';


const Patcher = createPatcher('unbound::tracking');
const Logger = createLogger('Core', 'Tracking');

export const data: BuiltInData = {
	name: 'Tracking'
};

export function start() {
	patchMetadataTrackers();
	patchSuperProperties();
	patchActionHandlers();
}

export function stop() {
	Patcher.unpatchAll();
}

function patchMetadataTrackers() {
	const Metadata = findByProps('trackWithMetadata');
	if (!Metadata) return Logger.error('Failed to find metadata trackers.');

	Patcher.instead(Metadata, 'trackWithMetadata', noop);
}

function patchActionHandlers() {
	const Handlers = findByProps('AnalyticsActionHandlers');
	if (!Handlers) return Logger.error('Failed to find action handlers.');

	Patcher.instead(Handlers.AnalyticsActionHandlers, 'handleConnectionClosed', noop);
	Patcher.instead(Handlers.AnalyticsActionHandlers, 'handleConnectionOpen', noop);
	Patcher.instead(Handlers.AnalyticsActionHandlers, 'handleFingerprint', noop);
	Patcher.instead(Handlers.AnalyticsActionHandlers, 'handleTrack', noop);
}

function patchSuperProperties() {
	const Properties = findByProps('track', 'encodeProperties');
	if (!Properties) return Logger.error('Failed to find super properties.');

	Patcher.instead(Properties, 'track', noop);
}