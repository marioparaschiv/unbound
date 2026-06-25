import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';
import { createPatcher } from 'possess';

import { findByProps } from '~/api/metro';

const Patcher = createPatcher('unbound::tracking');
const Logger = createLogger('Tracking');

export function start() {
	patchMetadataTrackers();
	patchActionHandlers();
	patchSuperProperties();
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

export default { start, stop };
